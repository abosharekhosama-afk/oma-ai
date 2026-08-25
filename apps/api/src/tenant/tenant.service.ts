import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere, writeOutbox } from '@oma/db';
import {
  DomainError,
  SYSTEM_PROFILES,
  hashSessionToken,
  issueSessionToken,
  newId,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TenantService {
  constructor(private readonly audit: AuditService) {}

  async createTenant(
    actorUserId: string,
    input: { name: string; slug: string },
    correlationId?: string,
  ) {
    const prisma = getPrisma();
    const actorMemberships = await prisma.membership.findMany({
      where: { userId: actorUserId, status: 'ACTIVE' },
      include: { grants: { where: { revokedAt: null } } },
    });
    const platformCaps = actorMemberships.flatMap((m) => m.grants.map((g) => g.capabilityCode));
    // Platform owner may also be identified via any grant of platform.tenant.create on any membership OR bootstrap user with profile
    const hasPlatform = platformCaps.includes('platform.tenant.create');
    // Also allow users who have PLATFORM_OWNER profile grants created at bootstrap without tenant (store as grants on a system membership)
    const platformUser = await prisma.capabilityGrant.findFirst({
      where: {
        capabilityCode: 'platform.tenant.create',
        revokedAt: null,
        membership: { userId: actorUserId, status: 'ACTIVE' },
      },
    });
    if (!hasPlatform && !platformUser) {
      // Check platform grants table via memberships across tenants
      const any = await prisma.capabilityGrant.findFirst({
        where: {
          capabilityCode: 'platform.tenant.create',
          revokedAt: null,
          membership: { userId: actorUserId, status: 'ACTIVE' },
        },
      });
      if (!any)
        throw new DomainError(
          'PERMISSION_DENIED',
          'Missing platform.tenant.create',
          403,
          'errors.permission_denied',
        );
    }

    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: { id: newId(), name: input.name, slug: input.slug, status: 'ACTIVE' },
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
    });
    if (!membership)
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
      throw new DomainError('UNAUTHENTICATED', 'Session invalid', 401, 'errors.unauthenticated');
    }
    await prisma.session.update({ where: { id: session.id }, data: { activeTenantId: tenantId } });
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'tenant.switched',
      targetType: 'Tenant',
      targetId: tenantId,
      correlationId,
    });
    return { active_tenant_id: tenantId };
  }

  async invite(actorUserId: string, tenantId: string, email: string, correlationId?: string) {
    const prisma = getPrisma();
    const normalizedEmail = email.trim().toLowerCase();
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
    };
  }

  async acceptInvite(userId: string, token: string) {
    const prisma = getPrisma();
    const inv = await prisma.invitation.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { membership: true },
    });
    if (!inv || inv.revokedAt || inv.acceptedAt || inv.expiresAt < new Date()) {
      throw new DomainError('NOT_FOUND', 'Invitation not found', 404, 'errors.not_found');
    }
    await prisma.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: inv.membershipId },
        data: { userId, status: 'ACTIVE', acceptedAt: new Date() },
      });
      await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
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
