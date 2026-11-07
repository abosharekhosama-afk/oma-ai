import { Body, Controller, Delete, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getPrisma } from '@oma/db';
import { DomainError, assertPasswordPolicy, hashPassword, verifyPassword } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { clearSessionCookie } from '../identity/session-cookie';
import { NOTIFICATION_TYPES, parsePreferences } from '../notifications/notify';

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
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatar_url: u.avatarUrl,
    preferred_locale: u.preferredLocale,
    preferred_dir: u.preferredDir,
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
      email?: string;
      avatarUrl?: string | null;
      preferredLocale?: string;
      preferredDir?: string;
    } = {};
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 120) throw bad('name');
      data.name = name;
    }
    if (body.email !== undefined) {
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('email');
      const existing = await getPrisma().user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        throw new DomainError(
          'CONFLICT_STATE',
          'Email already registered',
          409,
          'errors.email_taken',
        );
      }
      data.email = email;
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

  @Get('export')
  async exportData(@Req() req: Request) {
    const userId = this.uid(req);
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: { include: { tenant: { select: { id: true, name: true, slug: true } } } },
        authIdentities: { select: { provider: true, email: true, createdAt: true } },
      },
    });
    const comments = await prisma.contentComment.findMany({
      where: { authorUserId: userId },
      take: 200,
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: {
        exported_at: new Date().toISOString(),
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          preferred_locale: user.preferredLocale,
          terms_accepted_at: user.termsAcceptedAt?.toISOString() ?? null,
          terms_version: user.termsVersion ?? null,
          created_at: user.createdAt.toISOString(),
        },
        preferences: mergePreferences(user.preferencesJson),
        workspaces: user.memberships.map((m) => ({
          membership_id: m.id,
          tenant_id: m.tenantId,
          tenant_name: m.tenant.name,
          role: m.displayRole ?? m.membershipKind,
          status: m.status,
        })),
        identities: user.authIdentities,
        comments_count: comments.length,
      },
    };
  }

  @Delete('account')
  @UseGuards(CsrfGuard)
  async deleteAccount(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = this.uid(req);
    const prisma = getPrisma();
    const anonymizedEmail = `deleted-${userId}@deleted.oma.local`;
    await prisma.$transaction([
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.membership.updateMany({
        where: { userId },
        data: { status: 'REMOVED', removedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          email: anonymizedEmail,
          name: 'Deleted User',
          passwordHash: null,
          avatarUrl: null,
        },
      }),
    ]);
    clearSessionCookie(res);
    return { data: { deleted: true } };
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
