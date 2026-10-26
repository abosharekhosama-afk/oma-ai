import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { getPrisma } from '@oma/db';
import { DomainError } from '@oma/domain';
import { AuthGuard } from '../common/guards/auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { NOTIFICATION_TYPES, parsePreferences } from '../notifications/notify';

/** Per-user preference defaults (formerly demo-only; now persisted on User.preferencesJson). */
export const DEFAULT_PREFERENCES = {
  timezone: 'Asia/Dubai',
  weekStart: 'monday' as 'monday' | 'sunday',
  defaultContentView: 'calendar' as 'list' | 'calendar' | 'feed' | 'grid',
  defaultTaskView: 'board' as 'board' | 'list',
  reviewReminders: true,
  localePreference: 'system' as 'en' | 'ar' | 'system',
  /** Home "Finish setup" side card dismissed by this user. */
  homeSetupDismissed: false,
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
  if (body.weekStart !== undefined) {
    if (body.weekStart !== 'monday' && body.weekStart !== 'sunday') throw bad('weekStart');
    out.weekStart = body.weekStart;
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
        if (!/^https:\/\/[^\s]+$/i.test(url) || url.length > 1000) throw bad('avatarUrl');
        data.avatarUrl = url;
      }
    }
    if (body.preferredLocale !== undefined) {
      if (body.preferredLocale !== 'en' && body.preferredLocale !== 'ar')
        throw bad('preferredLocale');
      data.preferredLocale = body.preferredLocale;
      data.preferredDir = body.preferredLocale === 'ar' ? 'rtl' : 'ltr';
    }
    const u = await getPrisma().user.update({ where: { id: this.uid(req) }, data });
    return { data: mapProfile(u) };
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
