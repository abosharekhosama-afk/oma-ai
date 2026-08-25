import { Injectable } from '@nestjs/common';
import { getPrisma, writeOutbox } from '@oma/db';
import {
  DomainError,
  assertPasswordPolicy,
  hashPassword,
  issueSessionToken,
  newId,
  verifyPassword,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class IdentityService {
  constructor(private readonly audit: AuditService) {}

  async register(input: { email: string; password: string; name: string }) {
    assertPasswordPolicy(input.password);
    const email = input.email.trim().toLowerCase();
    const existing = await getPrisma().user.findUnique({ where: { email } });
    if (existing)
      throw new DomainError(
        'CONFLICT_STATE',
        'Email already registered',
        409,
        'errors.email_taken',
      );
    const user = await getPrisma().user.create({
      data: {
        id: newId(),
        email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        status: 'ACTIVE',
      },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: 'user.registered',
      targetType: 'User',
      targetId: user.id,
    });
    return user;
  }

  async login(input: { email: string; password: string; ip?: string; userAgent?: string }) {
    const email = input.email.trim().toLowerCase();
    const user = await getPrisma().user.findUnique({ where: { email } });
    if (!user?.passwordHash || user.status !== 'ACTIVE') {
      await this.audit.write({ action: 'user.login_failed', actorType: 'USER', afterRef: email });
      throw new DomainError(
        'UNAUTHENTICATED',
        'Invalid credentials',
        401,
        'errors.invalid_credentials',
      );
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      await this.audit.write({ actorUserId: user.id, action: 'user.login_failed' });
      throw new DomainError(
        'UNAUTHENTICATED',
        'Invalid credentials',
        401,
        'errors.invalid_credentials',
      );
    }
    const { token, tokenHash } = issueSessionToken();
    const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 604800);
    const session = await getPrisma().session.create({
      data: {
        id: newId(),
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + ttl * 1000),
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: 'user.login',
      targetType: 'Session',
      targetId: session.id,
    });
    return { user, token, session };
  }

  async logout(sessionId: string, userId: string) {
    await getPrisma().session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.write({
      actorUserId: userId,
      action: 'user.logout',
      targetType: 'Session',
      targetId: sessionId,
    });
  }

  async me(userId: string) {
    const user = await getPrisma().user.findUniqueOrThrow({ where: { id: userId } });
    const memberships = await getPrisma().membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { tenant: true, grants: { where: { revokedAt: null } } },
    });
    const session = await getPrisma().session.findFirst({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        preferred_locale: user.preferredLocale,
        preferred_dir: user.preferredDir,
      },
      active_tenant_id: session?.activeTenantId ?? null,
      memberships: memberships.map((m) => ({
        id: m.id,
        tenant_id: m.tenantId,
        tenant_name: m.tenant.name,
        capabilities: m.grants.map((g) => g.capabilityCode),
      })),
    };
  }

  async requestRecovery(email: string) {
    const user = await getPrisma().user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return { ok: true };
    const { token, tokenHash } = issueSessionToken();
    await getPrisma().recoveryToken.create({
      data: { id: newId(), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 3600_000) },
    });
    await getPrisma().$transaction(async (tx) => {
      await writeOutbox(tx, {
        eventType: 'mail.recovery',
        payload: { to: user.email, token },
      });
    });
    return { ok: true };
  }
}
