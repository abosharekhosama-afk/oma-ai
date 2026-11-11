import { getPrisma } from '@oma/db';
import {
  assertPasswordPolicy,
  DomainError,
  hashPassword,
  isSuperAdmin,
  newId,
  SYSTEM_ROLES,
  type SystemRole,
} from '@oma/domain';
import { randomBytes } from 'node:crypto';
import type { AuditService } from '../audit/audit.service';

const OPERATOR_ROLES = ['SUPER_ADMIN', 'SUPPORT_SPECIALIST'] as const;

function parseOperatorRole(raw: unknown): SystemRole {
  const role = typeof raw === 'string' ? raw.trim().toUpperCase() : 'SUPPORT_SPECIALIST';
  if (role === 'SUPER_ADMIN' || role === 'SUPPORT_SPECIALIST') return role;
  throw new DomainError(
    'VALIDATION_FAILED',
    'Invalid system_role',
    400,
    'errors.validation_failed',
  );
}

export async function listPlatformOperators(q?: string) {
  const prisma = getPrisma();
  const where = q?.trim()
    ? {
        AND: [
          { systemRole: { in: [...OPERATOR_ROLES] } },
          {
            OR: [
              { email: { contains: q.trim(), mode: 'insensitive' as const } },
              { name: { contains: q.trim(), mode: 'insensitive' as const } },
              { id: q.trim() },
            ],
          },
        ],
      }
    : { systemRole: { in: [...OPERATOR_ROLES] } };
  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ systemRole: 'asc' }, { createdAt: 'desc' }],
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      systemRole: true,
      createdAt: true,
    },
  });
  return {
    data: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      status: u.status,
      system_role: u.systemRole,
      created_at: u.createdAt.toISOString(),
    })),
  };
}

export async function createOrPromoteOperator(
  audit: AuditService,
  actorUserId: string,
  body: {
    email: string;
    name?: string;
    password?: string;
    system_role?: unknown;
  },
  correlationId?: string,
) {
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    throw new DomainError('VALIDATION_FAILED', 'email required', 400, 'errors.validation_failed');
  }
  const targetRole = parseOperatorRole(body.system_role);
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email } });
  let generatedPassword: string | undefined;

  if (existing) {
    if (existing.systemRole === 'SUPER_ADMIN' && targetRole !== 'SUPER_ADMIN') {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Cannot demote super admin via create',
        400,
        'errors.validation_failed',
      );
    }
    const data: { systemRole: SystemRole; name?: string; passwordHash?: string } = {
      systemRole: targetRole,
    };
    if (body.name?.trim()) data.name = body.name.trim();
    if (body.password?.trim()) {
      assertPasswordPolicy(body.password);
      data.passwordHash = await hashPassword(body.password);
    }
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        systemRole: true,
      },
    });
    await audit.write({
      actorUserId,
      actorType: 'SUPER_ADMIN',
      action: 'platform.operator.promoted',
      targetType: 'User',
      targetId: updated.id,
      afterRef: JSON.stringify({ system_role: targetRole }),
      correlationId,
    });
    return {
      data: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        status: updated.status,
        system_role: updated.systemRole,
        created: false,
      },
    };
  }

  const name = body.name?.trim() || email.split('@')[0] || 'Support';
  let password = body.password?.trim();
  if (!password) {
    generatedPassword = randomBytes(12).toString('base64url');
    password = generatedPassword;
  }
  assertPasswordPolicy(password);
  const user = await prisma.user.create({
    data: {
      id: newId(),
      email,
      name,
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
      systemRole: targetRole,
      termsAcceptedAt: new Date(),
      termsVersion: 'operator-provisioned',
      privacyAcceptedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      systemRole: true,
    },
  });
  await audit.write({
    actorUserId,
    actorType: 'SUPER_ADMIN',
    action: 'platform.operator.created',
    targetType: 'User',
    targetId: user.id,
    afterRef: JSON.stringify({ system_role: targetRole }),
    correlationId,
  });
  return {
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      system_role: user.systemRole,
      created: true,
      ...(generatedPassword ? { temporary_password: generatedPassword } : {}),
    },
  };
}

export async function patchPlatformOperator(
  audit: AuditService,
  actorUserId: string,
  userId: string,
  body: { system_role?: unknown },
  correlationId?: string,
) {
  if (!body.system_role) {
    throw new DomainError('VALIDATION_FAILED', 'system_role required', 400, 'errors.validation_failed');
  }
  const next = String(body.system_role).trim().toUpperCase();
  if (!(SYSTEM_ROLES as readonly string[]).includes(next)) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid system_role', 400, 'errors.validation_failed');
  }
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, systemRole: true, email: true },
  });
  if (!user) throw new DomainError('NOT_FOUND', 'User not found', 404, 'errors.not_found');

  if (userId === actorUserId && user.systemRole === 'SUPER_ADMIN' && next !== 'SUPER_ADMIN') {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Cannot demote your own super admin role',
      400,
      'errors.validation_failed',
    );
  }

  if (user.systemRole === 'SUPER_ADMIN' && next === 'USER') {
    const supers = await prisma.user.count({ where: { systemRole: 'SUPER_ADMIN', status: 'ACTIVE' } });
    if (supers <= 1) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'At least one super admin is required',
        400,
        'errors.validation_failed',
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { systemRole: next as SystemRole },
    select: { id: true, email: true, name: true, status: true, systemRole: true },
  });

  await audit.write({
    actorUserId,
    actorType: isSuperAdmin(next) ? 'SUPER_ADMIN' : 'SUPPORT',
    action: 'platform.operator.role_updated',
    targetType: 'User',
    targetId: userId,
    beforeRef: JSON.stringify({ system_role: user.systemRole }),
    afterRef: JSON.stringify({ system_role: next }),
    correlationId,
  });

  return {
    data: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      status: updated.status,
      system_role: updated.systemRole,
    },
  };
}
