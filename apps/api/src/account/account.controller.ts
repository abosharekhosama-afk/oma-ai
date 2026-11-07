import { Body, Controller, Delete, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { getPrisma } from '@oma/db';
import { DomainError, assertPasswordPolicy, hashPassword, verifyPassword } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import {
  buildOtpAuthUri,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotpCode,
} from '../identity/totp';
import { NOTIFICATION_TYPES, parsePreferences } from '../notifications/notify';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Per-user preference defaults (formerly demo-only; now persisted on User.preferencesJson). */
export const DEFAULT_PREFERENCES = {
  timezone: 'Asia/Jerusalem',
  hourFormat: '24h' as '24h' | '12h',
  weekStart: 'monday' as 'monday' | 'sunday',
  twoFactorEnabled: false,
  defaultContentView: 'calendar' as 'list' | 'calendar' | 'feed' | 'grid',
  defaultTaskView: 'board' as 'board' | 'list',
  reviewReminders: true,
  localePreference: 'system' as 'en' | 'ar' | 'system',
  /** Home "Finish setup" side card dismissed by this user. */
  homeSetupDismissed: false,
  /** Campaign ids starred on the campaigns portfolio view (tenant-scoped ids). */
  campaignFavoriteIds: [] as string[],
  notifications: Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, true])) as Record<
    string,
    boolean
  >,
};
export type UserPreferences = typeof DEFAULT_PREFERENCES;

const bad = (msg: string) =>
  new DomainError('VALIDATION_FAILED', msg, 400, 'errors.validation_failed');

export function mergePreferences(raw: string | null | undefined): UserPreferences {
  const stored = parsePreferences(raw) as Partial<UserPreferences>;
  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
    notifications: { ...DEFAULT_PREFERENCES.notifications, ...(stored.notifications ?? {}) },
  };
}

/** Validate a partial preferences patch; throws 400 on bad values. */
export function validatePreferencesPatch(body: Record<string, unknown>): Partial<UserPreferences> {
  const out: Partial<UserPreferences> = {};
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || !body.timezone.trim()) throw bad('timezone');
    try {
      new Intl.DateTimeFormat('en', { timeZone: body.timezone.trim() });
    } catch {
      throw bad('timezone');
    }
    out.timezone = body.timezone.trim();
  }
  if (body.hourFormat !== undefined) {
    if (body.hourFormat !== '24h' && body.hourFormat !== '12h') throw bad('hourFormat');
    out.hourFormat = body.hourFormat;
  }
  if (body.weekStart !== undefined) {
    if (body.weekStart !== 'monday' && body.weekStart !== 'sunday') throw bad('weekStart');
    out.weekStart = body.weekStart;
  }
  if (body.twoFactorEnabled !== undefined) {
    if (typeof body.twoFactorEnabled !== 'boolean') throw bad('twoFactorEnabled');
    out.twoFactorEnabled = body.twoFactorEnabled;
  }
  if (body.defaultContentView !== undefined) {
    if (!['list', 'calendar', 'feed', 'grid'].includes(String(body.defaultContentView)))
      throw bad('defaultContentView');
    out.defaultContentView = body.defaultContentView as UserPreferences['defaultContentView'];
  }
  if (body.defaultTaskView !== undefined) {
    if (body.defaultTaskView !== 'board' && body.defaultTaskView !== 'list')
      throw bad('defaultTaskView');
    out.defaultTaskView = body.defaultTaskView;
  }
  if (body.reviewReminders !== undefined) out.reviewReminders = Boolean(body.reviewReminders);
  if (body.homeSetupDismissed !== undefined) {
    if (typeof body.homeSetupDismissed !== 'boolean') throw bad('homeSetupDismissed');
    out.homeSetupDismissed = body.homeSetupDismissed;
  }
  if (body.campaignFavoriteIds !== undefined) {
    if (!Array.isArray(body.campaignFavoriteIds)) throw bad('campaignFavoriteIds');
    const ids = body.campaignFavoriteIds
      .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 64)
      .slice(0, 500);
    out.campaignFavoriteIds = ids;
  }
  if (body.localePreference !== undefined) {
    if (!['en', 'ar', 'system'].includes(String(body.localePreference)))
      throw bad('localePreference');
    out.localePreference = body.localePreference as UserPreferences['localePreference'];
  }
  if (body.notifications !== undefined) {
    if (!body.notifications || typeof body.notifications !== 'object') throw bad('notifications');
    const n: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(body.notifications as Record<string, unknown>)) {
      if (k !== 'all' && !(NOTIFICATION_TYPES as readonly string[]).includes(k)) continue;
      if (typeof v !== 'boolean') throw bad(`notifications.${k}`);
      n[k] = v;
    }
    out.notifications = n;
  }
  return out;
}

function mapProfile(u: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  preferredLocale: string;
  preferredDir: string;
  twoFactorEnabled?: boolean;
  deletionScheduledAt?: Date | null;
  deletionPurgeAt?: Date | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar_url: u.avatarUrl,
    preferred_locale: u.preferredLocale,
    preferred_dir: u.preferredDir,
    two_factor_enabled: Boolean(u.twoFactorEnabled),
    deletion_scheduled_at: u.deletionScheduledAt?.toISOString() ?? null,
    deletion_purge_at: u.deletionPurgeAt?.toISOString() ?? null,
  };
}

@Controller('api/v1/me')
@UseGuards(AuthGuard)
export class AccountController {
  private uid(req: Request): string {
    if (!req.oma?.userId)
      throw new DomainError(
        'UNAUTHENTICATED',
        'Authentication required',
        401,
        'errors.unauthenticated',
      );
    return req.oma.userId;
  }

  @Get('profile')
  async profile(@Req() req: Request) {
    const u = await getPrisma().user.findUniqueOrThrow({ where: { id: this.uid(req) } });
    return { data: mapProfile(u) };
  }

  @Patch('profile')
  @UseGuards(CsrfGuard)
  async updateProfile(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const userId = this.uid(req);
    const data: {
      name?: string;
      avatarUrl?: string | null;
      preferredLocale?: string;
      preferredDir?: string;
    } = {};
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 120) throw bad('name');
      data.name = name;
    }
    if (body.avatarUrl !== undefined) {
      if (body.avatarUrl === null || body.avatarUrl === '') data.avatarUrl = null;
      else {
        const url = String(body.avatarUrl).trim();
        const internalMedia = /^\/api\/v1\/media\/[A-Za-z0-9_-]+\/view$/i.test(url);
        if ((!/^https:\/\/[^\s]+$/i.test(url) && !internalMedia) || url.length > 1000)
          throw bad('avatarUrl');
        data.avatarUrl = url;
      }
    }
    if (body.preferredLocale !== undefined) {
      if (body.preferredLocale !== 'en' && body.preferredLocale !== 'ar')
        throw bad('preferredLocale');
      data.preferredLocale = body.preferredLocale;
      data.preferredDir = body.preferredLocale === 'ar' ? 'rtl' : 'ltr';
    }
    const u = await getPrisma().user.update({ where: { id: userId }, data });
    return { data: mapProfile(u) };
  }

  @Post('password')
  @UseGuards(CsrfGuard)
  async changePassword(
    @Req() req: Request,
    @Body() body: { current_password?: string; new_password?: string },
  ) {
    const userId = this.uid(req);
    const newPassword = String(body?.new_password ?? '');
    assertPasswordPolicy(newPassword);
    const prisma = getPrisma();
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.passwordHash && body?.current_password) {
      const ok = await verifyPassword(u.passwordHash, body.current_password);
      if (!ok) {
        throw new DomainError(
          'UNAUTHENTICATED',
          'Current password is incorrect',
          401,
          'errors.invalid_credentials',
        );
      }
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    return { data: { ok: true } };
  }

  /** Step 1 of 2FA: generate a TOTP secret and otpauth URI for the authenticator app. */
  @Post('2fa/setup')
  @UseGuards(CsrfGuard)
  async setupTwoFactor(@Req() req: Request) {
    const userId = this.uid(req);
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = generateTotpSecret();
    const backupCodes = generateBackupCodes(6);
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      },
    });
    const otpauthUri = buildOtpAuthUri({ secret, email: user.email, issuer: 'OMA AI' });
    return {
      data: {
        secret,
        otpauth_uri: otpauthUri,
        backup_codes: backupCodes,
      },
    };
  }

  /** Step 2 of 2FA: verify the 6-digit code from the authenticator app and activate 2FA. */
  @Post('2fa/verify')
  @UseGuards(CsrfGuard)
  async verifyTwoFactor(@Req() req: Request, @Body() body: { code?: string }) {
    const userId = this.uid(req);
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Start 2FA setup first before verifying a code',
        400,
        'errors.validation_failed',
      );
    }
    const code = String(body?.code ?? '').trim();
    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Invalid 6-digit verification code. Check your authenticator app and try again.',
        400,
        'errors.two_factor_invalid_code',
      );
    }
    const prefs = mergePreferences(user.preferencesJson);
    prefs.twoFactorEnabled = true;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        preferencesJson: JSON.stringify(prefs),
      },
    });
    let backupCodes: string[] = [];
    try {
      backupCodes = user.twoFactorBackupCodes
        ? (JSON.parse(user.twoFactorBackupCodes) as string[])
        : [];
    } catch {
      backupCodes = [];
    }
    return {
      data: {
        two_factor_enabled: updated.twoFactorEnabled,
        backup_codes: backupCodes,
      },
    };
  }

  /** Disable 2FA on the account. */
  @Post('2fa/disable')
  @UseGuards(CsrfGuard)
  async disableTwoFactor(@Req() req: Request) {
    const userId = this.uid(req);
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const prefs = mergePreferences(user.preferencesJson);
    prefs.twoFactorEnabled = false;
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
        preferencesJson: JSON.stringify(prefs),
      },
    });
    return { data: { two_factor_enabled: false } };
  }

  /** Comprehensive personal & workspace data export (GDPR / compliance archive). */
  @Get('export')
  async exportData(@Req() req: Request) {
    const userId = this.uid(req);
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                defaultLocale: true,
                createdAt: true,
              },
            },
            grants: { where: { revokedAt: null }, select: { capabilityCode: true } },
          },
        },
        authIdentities: { select: { provider: true, email: true, createdAt: true } },
      },
    });

    const tenantIds = [
      ...new Set(user.memberships.filter((m) => m.status === 'ACTIVE').map((m) => m.tenantId)),
    ];

    const [brands, posts, comments, campaigns, socialPages, sessions, auditEvents] =
      await Promise.all([
        tenantIds.length
          ? prisma.brandWorkspace.findMany({
              where: { tenantId: { in: tenantIds }, deletedAt: null },
              select: {
                id: true,
                tenantId: true,
                name: true,
                status: true,
                createdAt: true,
              },
              take: 200,
            })
          : Promise.resolve([]),
        tenantIds.length
          ? prisma.contentItem.findMany({
              where: { tenantId: { in: tenantIds } },
              select: {
                id: true,
                tenantId: true,
                brandId: true,
                titleEn: true,
                titleAr: true,
                captionEn: true,
                captionAr: true,
                channel: true,
                contentType: true,
                status: true,
                approvalState: true,
                scheduledAt: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 500,
            })
          : Promise.resolve([]),
        prisma.contentComment.findMany({
          where: { authorUserId: userId },
          select: {
            id: true,
            contentId: true,
            bodyEn: true,
            bodyAr: true,
            isInternal: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        tenantIds.length
          ? prisma.campaign.findMany({
              where: { tenantId: { in: tenantIds } },
              select: {
                id: true,
                tenantId: true,
                brandId: true,
                nameEn: true,
                nameAr: true,
                status: true,
                createdAt: true,
              },
              take: 200,
            })
          : Promise.resolve([]),
        tenantIds.length
          ? prisma.socialPage.findMany({
              where: { tenantId: { in: tenantIds }, status: { not: 'DISCONNECTED' } },
              select: {
                id: true,
                brandId: true,
                network: true,
                name: true,
                externalId: true,
                status: true,
                createdAt: true,
              },
              take: 200,
            })
          : Promise.resolve([]),
        prisma.session.findMany({
          where: { userId },
          select: {
            id: true,
            ip: true,
            userAgent: true,
            createdAt: true,
            lastSeenAt: true,
            expiresAt: true,
            revokedAt: true,
          },
          orderBy: { lastSeenAt: 'desc' },
          take: 50,
        }),
        prisma.auditEvent.findMany({
          where: { actorUserId: userId },
          select: {
            id: true,
            action: true,
            targetType: true,
            targetId: true,
            occurredAt: true,
          },
          orderBy: { occurredAt: 'desc' },
          take: 300,
        }),
      ]);

    return {
      data: {
        schema_version: '2026-11',
        exported_at: new Date().toISOString(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_url: user.avatarUrl,
          preferred_locale: user.preferredLocale,
          two_factor_enabled: user.twoFactorEnabled,
          terms_accepted_at: user.termsAcceptedAt?.toISOString() ?? null,
          terms_version: user.termsVersion ?? null,
          privacy_accepted_at: user.privacyAcceptedAt?.toISOString() ?? null,
          deletion_scheduled_at: user.deletionScheduledAt?.toISOString() ?? null,
          deletion_purge_at: user.deletionPurgeAt?.toISOString() ?? null,
          created_at: user.createdAt.toISOString(),
        },
        preferences: mergePreferences(user.preferencesJson),
        identities: user.authIdentities,
        workspaces: user.memberships.map((m) => ({
          membership_id: m.id,
          tenant_id: m.tenantId,
          tenant_name: m.tenant.name,
          tenant_slug: m.tenant.slug,
          role: m.displayRole ?? m.membershipKind,
          status: m.status,
          capabilities: m.grants.map((g) => g.capabilityCode),
        })),
        brands,
        social_pages: socialPages,
        campaigns,
        posts,
        comments,
        sessions,
        audit_events: auditEvents,
      },
    };
  }

  /**
   * Schedule the user's account and data for permanent erasure in 30 days.
   * The user can cancel this scheduled deletion any time during the 30-day window.
   */
  @Delete('account')
  @UseGuards(CsrfGuard)
  async scheduleDeleteAccount(@Req() req: Request) {
    const userId = this.uid(req);
    const prisma = getPrisma();
    const now = new Date();
    const purgeAt = new Date(now.getTime() + THIRTY_DAYS_MS);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        deletionScheduledAt: now,
        deletionPurgeAt: purgeAt,
      },
    });
    return {
      data: {
        scheduled: true,
        deletion_scheduled_at: updated.deletionScheduledAt?.toISOString() ?? now.toISOString(),
        deletion_purge_at: updated.deletionPurgeAt?.toISOString() ?? purgeAt.toISOString(),
        grace_period_days: 30,
      },
    };
  }

  /** Cancel a pending 30-day scheduled account deletion. */
  @Post('account/cancel-deletion')
  @UseGuards(CsrfGuard)
  async cancelDeleteAccount(@Req() req: Request) {
    const userId = this.uid(req);
    const prisma = getPrisma();
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionScheduledAt: null,
        deletionPurgeAt: null,
      },
    });
    return {
      data: {
        scheduled: false,
        deletion_scheduled_at: null,
        deletion_purge_at: null,
      },
    };
  }

  @Get('preferences')
  async preferences(@Req() req: Request) {
    const u = await getPrisma().user.findUniqueOrThrow({
      where: { id: this.uid(req) },
      select: { preferencesJson: true },
    });
    return { data: mergePreferences(u.preferencesJson) };
  }

  @Patch('preferences')
  @UseGuards(CsrfGuard)
  async updatePreferences(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const id = this.uid(req);
    const patch = validatePreferencesPatch(body ?? {});
    const prisma = getPrisma();
    const u = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { preferencesJson: true },
    });
    const current = mergePreferences(u.preferencesJson);
    const next: UserPreferences = {
      ...current,
      ...patch,
      notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
    };
    await prisma.user.update({
      where: { id },
      data: {
        preferencesJson: JSON.stringify(next),
        ...(patch.localePreference && patch.localePreference !== 'system'
          ? {
              preferredLocale: patch.localePreference,
              preferredDir: patch.localePreference === 'ar' ? 'rtl' : 'ltr',
            }
          : {}),
      },
    });
    return { data: next };
  }
}
