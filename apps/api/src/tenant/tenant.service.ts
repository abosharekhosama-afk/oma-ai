import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere, writeOutbox } from '@oma/db';
import {
  DomainError,
  SYSTEM_PROFILES,
  assertCompanyName,
  hashSessionToken,
  issueSessionToken,
  newId,
  resolveMembershipRoute,
  slugifyCompanyName,
  uniquifySlug,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TenantService {
  constructor(private readonly audit: AuditService) {}

  private async actorMayCreateTenant(actorUserId: string): Promise<'platform' | 'self_serve'> {
    const prisma = getPrisma();
    const activeMemberships = await prisma.membership.findMany({
      where: { userId: actorUserId, status: 'ACTIVE' },
      include: { grants: { where: { revokedAt: null } } },
    });
    const platformCaps = activeMemberships.flatMap((m) => m.grants.map((g) => g.capabilityCode));
    if (platformCaps.includes('platform.tenant.create')) {
      return 'platform';
    }
    const platformGrant = await prisma.capabilityGrant.findFirst({
      where: {
        capabilityCode: 'platform.tenant.create',
        revokedAt: null,
        membership: { userId: actorUserId, status: 'ACTIVE' },
      },
    });
    if (platformGrant) return 'platform';

    const distinctActiveTenants = new Set(activeMemberships.map((m) => m.tenantId));
    if (distinctActiveTenants.size === 0) {
      return 'self_serve';
    }
    throw new DomainError(
      'PERMISSION_DENIED',
      'Missing platform.tenant.create',
      403,
      'errors.permission_denied',
    );
  }

  async createTenant(
    actorUserId: string,
    input: { name: string; slug?: string },
    correlationId?: string,
    sessionToken?: string,
  ) {
    await this.actorMayCreateTenant(actorUserId);
    const prisma = getPrisma();

    let name: string;
    try {
      name = assertCompanyName(input.name);
    } catch {
      throw new DomainError('VALIDATION_FAILED', 'Invalid company name', 400, 'errors.validation');
    }

    const baseSlug = input.slug?.trim()
      ? input.slug.trim().toLowerCase()
      : slugifyCompanyName(name);

    let slug: string;
    try {
      slug = await uniquifySlug(baseSlug, async (candidate) => {
        const existing = await prisma.tenant.findUnique({ where: { slug: candidate } });
        return !!existing;
      });
    } catch {
      throw new DomainError('VALIDATION_FAILED', 'Invalid company slug', 400, 'errors.validation');
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: { id: newId(), name, slug, status: 'ACTIVE' },
      });
      const membership = await tx.membership.create({
        data: {
          id: newId(),
          tenantId: t.id,
          userId: actorUserId,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });
      const ownerCaps = SYSTEM_PROFILES.COMPANY_OWNER ?? [];
      for (const code of ownerCaps) {
        await tx.capabilityGrant.create({
          data: {
            id: newId(),
            membershipId: membership.id,
            tenantId: t.id,
            capabilityCode: code,
            sourceProfileCode: 'COMPANY_OWNER',
            grantedBy: actorUserId,
          },
        });
      }
      await writeOutbox(tx, {
        tenantId: t.id,
        eventType: 'tenant.created',
        payload: { tenantId: t.id },
      });
      return t;
    });

    if (sessionToken) {
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(sessionToken) },
      });
      if (session && session.userId === actorUserId && !session.revokedAt) {
        await prisma.session.update({
          where: { id: session.id },
          data: { activeTenantId: tenant.id },
        });
      }
    }

    await this.audit.write({
      actorUserId,
      tenantId: tenant.id,
      action: 'tenant.created',
      targetType: 'Tenant',
      targetId: tenant.id,
      correlationId,
    });
    return tenant;
  }

  async setActiveTenant(
    userId: string,
    sessionToken: string,
    tenantId: string,
    correlationId?: string,
  ) {
    const prisma = getPrisma();
    const membership = await prisma.membership.findFirst({
      where: tenantWhere(tenantId, { userId, status: 'ACTIVE' }),
      include: { tenant: true },
    });
    if (!membership || membership.tenant.status !== 'ACTIVE')
      throw new DomainError(
        'PERMISSION_DENIED',
        'Not a member of tenant',
        403,
        'errors.permission_denied',
      );
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(sessionToken) },
    });
    if (!session || session.userId !== userId || session.revokedAt) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    }
    await prisma.session.update({
      where: { id: session.id },
      data: { activeTenantId: tenantId },
    });
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'tenant.activated',
      targetType: 'Session',
      targetId: session.id,
      correlationId,
    });
    return { active_tenant_id: tenantId };
  }

  /**
   * Apply DEC-015 routing against the caller's latest session:
   * clear invalid active tenant; auto-activate sole membership.
   */
  async reconcileSessionTenant(userId: string, sessionId: string) {
    const prisma = getPrisma();
    const memberships = await prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { tenant: true },
    });
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId || session.revokedAt) {
      return { active_tenant_id: null as string | null, route: 'ONBOARDING' as const };
    }
    const route = resolveMembershipRoute({
      activeMemberships: memberships.map((m) => ({
        tenantId: m.tenantId,
        tenantStatus: m.tenant.status,
      })),
      activeTenantId: session.activeTenantId,
    });

    if (route.kind === 'PROCEED') {
      return { active_tenant_id: route.tenantId, route: route.kind };
    }
    if (route.kind === 'AUTO_ACTIVATE') {
      await prisma.session.update({
        where: { id: session.id },
        data: { activeTenantId: route.tenantId },
      });
      return { active_tenant_id: route.tenantId, route: route.kind };
    }
    if (session.activeTenantId) {
      await prisma.session.update({
        where: { id: session.id },
        data: { activeTenantId: null },
      });
    }
    return {
      active_tenant_id: null as string | null,
      route: route.kind,
    };
  }

  async listCurrentMemberships(tenantId: string) {
    const prisma = getPrisma();
    const rows = await prisma.membership.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        grants: { where: { revokedAt: null }, select: { capabilityCode: true, sourceProfileCode: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      status: m.status,
      invited_email: m.invitedEmail,
      accepted_at: m.acceptedAt,
      user: m.user
        ? { id: m.user.id, email: m.user.email, name: m.user.name }
        : null,
      capabilities: [...new Set(m.grants.map((g) => g.capabilityCode))],
      source_profiles: [
        ...new Set(m.grants.map((g) => g.sourceProfileCode).filter(Boolean)),
      ],
    }));
  }

  async invite(actorUserId: string, tenantId: string, email: string, correlationId?: string) {
    const prisma = getPrisma();
    const tenant = await prisma.tenant.findFirst({ where: { id: tenantId, status: 'ACTIVE' } });
    if (!tenant) {
      throw new DomainError('NOT_FOUND', 'Tenant not found', 404, 'errors.not_found');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid email', 400, 'errors.validation');
    }
    const membership = await prisma.membership.create({
      data: {
        id: newId(),
        tenantId,
        status: 'INVITED',
        invitedEmail: normalizedEmail,
        invitedBy: actorUserId,
        invitedAt: new Date(),
      },
    });
    const { token, tokenHash } = issueSessionToken();
    await prisma.invitation.create({
      data: {
        id: newId(),
        membershipId: membership.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      },
    });
    const jobRunId = newId();
    const idempotencyKey = `mail.invite:${membership.id}`;
    await prisma.$transaction(async (tx) => {
      await tx.jobRun.create({
        data: {
          id: jobRunId,
          tenantId,
          queue: 'mail',
          jobType: 'mail.invite',
          status: 'QUEUED',
          payloadJson: JSON.stringify({
            to: normalizedEmail,
            token,
            membershipId: membership.id,
          }),
          actorUserId,
          correlationId: correlationId ?? null,
          idempotencyKey,
        },
      });
      await writeOutbox(tx, {
        tenantId,
        eventType: 'mail.invite',
        payload: {
          to: normalizedEmail,
          token,
          membershipId: membership.id,
          tenantId,
          jobRunId,
          actorUserId,
          correlationId: correlationId ?? null,
          idempotencyKey,
        },
      });
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'membership.invited',
      targetType: 'Membership',
      targetId: membership.id,
      correlationId,
    });
    return {
      membership_id: membership.id,
      invite_token: token,
      job_run_id: jobRunId,
      expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    };
  }

  async acceptInvite(userId: string, token: string, sessionToken?: string) {
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const inv = await prisma.invitation.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { membership: { include: { tenant: true } } },
    });
    if (!inv || inv.revokedAt || inv.acceptedAt || inv.expiresAt < new Date()) {
      throw new DomainError('NOT_FOUND', 'Invitation not found', 404, 'errors.not_found');
    }
    if (inv.membership.tenant.status !== 'ACTIVE') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Company is not active',
        409,
        'errors.conflict_state',
      );
    }
    const invitedEmail = inv.membership.invitedEmail?.trim().toLowerCase();
    if (!invitedEmail || invitedEmail !== user.email.trim().toLowerCase()) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Invitation email does not match this account',
        403,
        'errors.permission_denied',
      );
    }
    await prisma.$transaction(async (tx) => {
      // Replay / concurrent accept protection: only the first accept wins.
      const claimed = await tx.invitation.updateMany({
        where: {
          id: inv.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new DomainError('NOT_FOUND', 'Invitation not found', 404, 'errors.not_found');
      }
      await tx.membership.update({
        where: { id: inv.membershipId },
        data: { userId, status: 'ACTIVE', acceptedAt: new Date() },
      });
      for (const code of SYSTEM_PROFILES.MEMBER ?? []) {
        await tx.capabilityGrant.create({
          data: {
            id: newId(),
            membershipId: inv.membershipId,
            tenantId: inv.membership.tenantId,
            capabilityCode: code,
            sourceProfileCode: 'MEMBER',
          },
        });
      }
    });

    if (sessionToken) {
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(sessionToken) },
      });
      if (session && session.userId === userId && !session.revokedAt) {
        const activeCount = await prisma.membership.count({
          where: { userId, status: 'ACTIVE' },
        });
        // Sole membership → activate; otherwise leave selector to choose.
        if (activeCount === 1) {
          await prisma.session.update({
            where: { id: session.id },
            data: { activeTenantId: inv.membership.tenantId },
          });
        }
      }
    }

    await this.audit.write({
      actorUserId: userId,
      tenantId: inv.membership.tenantId,
      action: 'membership.accepted',
      targetType: 'Membership',
      targetId: inv.membershipId,
    });
    return { ok: true, tenant_id: inv.membership.tenantId };
  }

  async suspendMembership(actorUserId: string, tenantId: string, membershipId: string) {
    const prisma = getPrisma();
    const m = await prisma.membership.findFirst({
      where: tenantWhere(tenantId, { id: membershipId }),
    });
    if (!m) throw new DomainError('NOT_FOUND', 'Membership not found', 404, 'errors.not_found');
    await prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'SUSPENDED', suspendedAt: new Date(), version: { increment: 1 } },
    });
    if (m.userId) {
      await prisma.session.updateMany({
        where: { userId: m.userId, activeTenantId: tenantId, revokedAt: null },
        data: { activeTenantId: null },
      });
    }
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'membership.suspended',
      targetType: 'Membership',
      targetId: membershipId,
    });
    return { ok: true };
  }

  async removeMembership(actorUserId: string, tenantId: string, membershipId: string) {
    const prisma = getPrisma();
    const m = await prisma.membership.findFirst({
      where: tenantWhere(tenantId, { id: membershipId }),
    });
    if (!m) throw new DomainError('NOT_FOUND', 'Membership not found', 404, 'errors.not_found');
    await prisma.membership.update({
      where: { id: membershipId },
      data: { status: 'REMOVED', removedAt: new Date(), version: { increment: 1 } },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'membership.removed',
      targetType: 'Membership',
      targetId: membershipId,
    });
    return { ok: true };
  }

  async assignCapabilities(
    actorUserId: string,
    tenantId: string,
    membershipId: string,
    codes: string[],
  ) {
    const prisma = getPrisma();
    const m = await prisma.membership.findFirst({
      where: tenantWhere(tenantId, { id: membershipId }),
    });
    if (!m) throw new DomainError('NOT_FOUND', 'Membership not found', 404, 'errors.not_found');
    for (const code of codes) {
      await prisma.capabilityGrant.create({
        data: {
          id: newId(),
          membershipId,
          tenantId,
          capabilityCode: code,
          grantedBy: actorUserId,
        },
      });
    }
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'capability.assigned',
      targetType: 'Membership',
      targetId: membershipId,
      afterRef: codes.join(','),
    });
    return { ok: true };
  }

  async attachProfile(
    actorUserId: string,
    tenantId: string,
    membershipId: string,
    profileCode: string,
  ) {
    const prisma = getPrisma();
    const profile =
      (await prisma.capabilityProfile.findFirst({ where: { code: profileCode, tenantId } })) ??
      (await prisma.capabilityProfile.findFirst({ where: { code: profileCode, tenantId: null } }));
    if (!profile) throw new DomainError('NOT_FOUND', 'Profile not found', 404, 'errors.not_found');
    return this.assignCapabilities(actorUserId, tenantId, membershipId, profile.capabilityCodes);
  }
}
