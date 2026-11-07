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
import { CURRENT_TERMS_VERSION, type OAuthUserProfile } from './oauth-providers.service';
import { verifyTotpCode } from './totp';

type MembershipRow = {
  id: string;
  tenantId: string;
  tenant: { name: string };
  grants: Array<{ capabilityCode: string }>;
};

/**
 * A user may hold more than one ACTIVE membership row for the same tenant.
 * Callers address companies by tenant, so collapse to one entry per tenant and
 * union the granted capabilities.
 */
function dedupeMembershipsByTenant(memberships: MembershipRow[]) {
  const byTenant = new Map<
    string,
    { id: string; tenant_id: string; tenant_name: string; capabilities: Set<string> }
  >();
  for (const m of memberships) {
    const entry = byTenant.get(m.tenantId) ?? {
      id: m.id,
      tenant_id: m.tenantId,
      tenant_name: m.tenant.name,
      capabilities: new Set<string>(),
    };
    for (const g of m.grants) entry.capabilities.add(g.capabilityCode);
    byTenant.set(m.tenantId, entry);
  }
  return [...byTenant.values()].map((e) => ({
    id: e.id,
    tenant_id: e.tenant_id,
    tenant_name: e.tenant_name,
    capabilities: [...e.capabilities],
  }));
}

@Injectable()
export class IdentityService {
  constructor(private readonly audit: AuditService) {}

  async register(input: {
    email: string;
    password: string;
    name: string;
    terms_accepted?: boolean;
    terms_version?: string;
  }) {
    if (input.terms_accepted === false) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'You must accept the Terms of Service and Privacy Policy to continue.',
        400,
        'errors.terms_required',
      );
    }
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
    const now = new Date();
    const termsVersion = input.terms_version?.trim() || CURRENT_TERMS_VERSION;
    const user = await getPrisma().user.create({
      data: {
        id: newId(),
        email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        termsAcceptedAt: now,
        termsVersion,
        privacyAcceptedAt: now,
        status: 'ACTIVE',
      },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: 'user.registered',
      targetType: 'User',
      targetId: user.id,
      afterRef: `terms:${termsVersion}`,
    });
    return user;
  }

  async login(input: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
    terms_accepted?: boolean;
    terms_version?: string;
    totp_code?: string;
  }) {
    if (input.terms_accepted === false) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'You must accept the Terms of Service and Privacy Policy to continue.',
        400,
        'errors.terms_required',
      );
    }
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
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const code = String(input.totp_code ?? '').trim();
      if (!code) {
        throw new DomainError(
          'UNAUTHENTICATED',
          'Enter the 6-digit verification code from your authenticator app.',
          403,
          'errors.two_factor_required',
        );
      }
      let backupMatched = false;
      if (!verifyTotpCode(user.twoFactorSecret, code)) {
        try {
          const backups = user.twoFactorBackupCodes
            ? (JSON.parse(user.twoFactorBackupCodes) as string[])
            : [];
          const idx = backups.findIndex((b) => b.toUpperCase() === code.toUpperCase());
          if (idx >= 0) {
            backupMatched = true;
            backups.splice(idx, 1);
            await getPrisma().user.update({
              where: { id: user.id },
              data: { twoFactorBackupCodes: JSON.stringify(backups) },
            });
          }
        } catch {
          backupMatched = false;
        }
        if (!backupMatched) {
          throw new DomainError(
            'UNAUTHENTICATED',
            'Invalid 6-digit two-factor authentication code.',
            401,
            'errors.two_factor_invalid_code',
          );
        }
      }
    }
    if (input.terms_accepted || !user.termsAcceptedAt) {
      const now = new Date();
      const version = input.terms_version?.trim() || user.termsVersion || CURRENT_TERMS_VERSION;
      await getPrisma().user.update({
        where: { id: user.id },
        data: {
          termsAcceptedAt: user.termsAcceptedAt ?? now,
          termsVersion: version,
          privacyAcceptedAt: user.privacyAcceptedAt ?? now,
        },
      });
    }
    return this.createSessionForUser(user.id, {
      ip: input.ip,
      userAgent: input.userAgent,
      auditAction: 'user.login',
    });
  }

  async createSessionForUser(
    userId: string,
    opts?: { ip?: string; userAgent?: string; auditAction?: string },
  ) {
    const user = await getPrisma().user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== 'ACTIVE') {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Account is not active',
        401,
        'errors.invalid_credentials',
      );
    }
    const { token, tokenHash } = issueSessionToken();
    const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 604800);
    const membershipTenantIds = (
      await getPrisma().membership.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        select: { tenantId: true },
        distinct: ['tenantId'],
      })
    ).map((m) => m.tenantId);
    const tenantIds = new Set(membershipTenantIds);
    const soleTenantId = tenantIds.size === 1 ? [...tenantIds][0]! : null;
    let resumeTenantId: string | null = soleTenantId;
    if (!resumeTenantId && tenantIds.size > 1) {
      const prev = await getPrisma().session.findFirst({
        where: {
          userId: user.id,
          activeTenantId: { not: null },
          revokedAt: null,
        },
        orderBy: { lastSeenAt: 'desc' },
        select: { activeTenantId: true },
      });
      if (prev?.activeTenantId && tenantIds.has(prev.activeTenantId)) {
        resumeTenantId = prev.activeTenantId;
      } else {
        const first = await getPrisma().membership.findFirst({
          where: { userId: user.id, status: 'ACTIVE', tenantId: { in: [...tenantIds] } },
          orderBy: { createdAt: 'asc' },
          select: { tenantId: true },
        });
        resumeTenantId = first?.tenantId ?? null;
      }
    }
    const session = await getPrisma().session.create({
      data: {
        id: newId(),
        userId: user.id,
        tokenHash,
        activeTenantId: resumeTenantId,
        expiresAt: new Date(Date.now() + ttl * 1000),
        ip: opts?.ip,
        userAgent: opts?.userAgent,
      },
    });
    await this.audit.write({
      actorUserId: user.id,
      action: opts?.auditAction ?? 'user.login',
      targetType: 'Session',
      targetId: session.id,
    });
    return { user, token, session };
  }

  async loginOrRegisterWithOAuth(
    profile: OAuthUserProfile,
    opts?: { ip?: string; userAgent?: string; termsVersion?: string | null },
  ) {
    const prisma = getPrisma();
    const email = profile.email.trim().toLowerCase();
    const now = new Date();
    const termsVersion = opts?.termsVersion || CURRENT_TERMS_VERSION;

    const existingIdentity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    let user = existingIdentity?.user ?? null;

    if (!user) {
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: newId(),
            email,
            name: profile.name,
            avatarUrl: profile.avatarUrl ?? null,
            emailVerifiedAt: profile.emailVerified ? now : null,
            termsAcceptedAt: now,
            termsVersion,
            privacyAcceptedAt: now,
            status: 'ACTIVE',
          },
        });
        await this.audit.write({
          actorUserId: user.id,
          action: `user.registered.${profile.provider}`,
          targetType: 'User',
          targetId: user.id,
          afterRef: `terms:${termsVersion}`,
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            avatarUrl: user.avatarUrl ?? profile.avatarUrl ?? null,
            emailVerifiedAt: user.emailVerifiedAt ?? (profile.emailVerified ? now : null),
            termsAcceptedAt: user.termsAcceptedAt ?? now,
            termsVersion: user.termsVersion ?? termsVersion,
            privacyAcceptedAt: user.privacyAcceptedAt ?? now,
          },
        });
      }

      await prisma.authIdentity.upsert({
        where: {
          provider_providerUserId: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
          },
        },
        update: {
          email,
          rawProfileJson: profile.raw ? JSON.stringify(profile.raw).slice(0, 4000) : null,
        },
        create: {
          id: newId(),
          userId: user.id,
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email,
          rawProfileJson: profile.raw ? JSON.stringify(profile.raw).slice(0, 4000) : null,
        },
      });
    } else if (!user.termsAcceptedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          termsAcceptedAt: now,
          termsVersion,
          privacyAcceptedAt: user.privacyAcceptedAt ?? now,
        },
      });
    }

    return this.createSessionForUser(user.id, {
      ip: opts?.ip,
      userAgent: opts?.userAgent,
      auditAction: `user.login.${profile.provider}`,
    });
  }

  async acceptTerms(userId: string, termsVersion = CURRENT_TERMS_VERSION) {
    const now = new Date();
    const updated = await getPrisma().user.update({
      where: { id: userId },
      data: {
        termsAcceptedAt: now,
        termsVersion: termsVersion.trim() || CURRENT_TERMS_VERSION,
        privacyAcceptedAt: now,
      },
    });
    await this.audit.write({
      actorUserId: userId,
      action: 'user.terms_accepted',
      targetType: 'User',
      targetId: userId,
      afterRef: `terms:${updated.termsVersion}`,
    });
    return {
      terms_accepted_at: updated.termsAcceptedAt?.toISOString() ?? now.toISOString(),
      terms_version: updated.termsVersion ?? CURRENT_TERMS_VERSION,
      privacy_accepted_at: updated.privacyAcceptedAt?.toISOString() ?? now.toISOString(),
    };
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
      // Oldest row first so the reported membership id matches the one the
      // authorization guard resolves for the same tenant.
      orderBy: { createdAt: 'asc' },
    });
    const session = await getPrisma().session.findFirst({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
    });
    const membershipRows = dedupeMembershipsByTenant(memberships);
    const activeTenantId = session?.activeTenantId ?? null;
    const activeCaps =
      membershipRows.find((m) => m.tenant_id === activeTenantId)?.capabilities ??
      membershipRows[0]?.capabilities ??
      [];
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        preferred_locale: user.preferredLocale,
        preferred_dir: user.preferredDir,
        avatar_url: user.avatarUrl ?? null,
        terms_accepted_at: user.termsAcceptedAt?.toISOString() ?? null,
        terms_version: user.termsVersion ?? null,
        privacy_accepted_at: user.privacyAcceptedAt?.toISOString() ?? null,
      },
      session_expires_at: session?.expiresAt.toISOString() ?? null,
      active_tenant_id: activeTenantId,
      capabilities: activeCaps,
      memberships: membershipRows,
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
    const jobRunId = newId();
    const idempotencyKey = `mail.recovery:${tokenHash}`;
    await getPrisma().$transaction(async (tx) => {
      await tx.jobRun.create({
        data: {
          id: jobRunId,
          tenantId: null,
          queue: 'mail',
          jobType: 'mail.recovery',
          status: 'QUEUED',
          payloadJson: JSON.stringify({ to: user.email, token }),
          actorUserId: user.id,
          idempotencyKey,
        },
      });
      await writeOutbox(tx, {
        eventType: 'mail.recovery',
        payload: {
          to: user.email,
          token,
          jobRunId,
          actorUserId: user.id,
          idempotencyKey,
          subject: 'OMA AI password recovery',
          text: `Recovery token (console adapter): ${token}`,
        },
      });
    });
    return { ok: true };
  }
}
