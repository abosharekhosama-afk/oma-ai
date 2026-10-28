import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  notificationTypeForAudit,
  wantsNotification,
} from '../../apps/api/src/notifications/notify';
import {
  mergePreferences,
  validatePreferencesPatch,
} from '../../apps/api/src/account/account.controller';
import {
  passwordResetLink,
  createMailProvider,
  NoopMailAdapter,
} from '../../apps/api/src/mail/mail-provider';
import { initials, safeReturnPath } from '../../apps/web/src/lib/account-api';
import { loginUrlFor, refreshDelayMs } from '../../apps/web/src/lib/session';
import { errorKindOf } from '../../apps/web/src/components/ui/error-state';
import en from '../../packages/i18n/messages/en.json';
import ar from '../../packages/i18n/messages/ar.json';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('notification preferences', () => {
  it('is opt-out per type and globally', () => {
    expect(wantsNotification('{}', 'task.assigned')).toBe(true);
    expect(wantsNotification(null, 'task.assigned')).toBe(true);
    expect(wantsNotification('not json', 'task.assigned')).toBe(true);
    expect(
      wantsNotification(
        JSON.stringify({ notifications: { 'task.assigned': false } }),
        'task.assigned',
      ),
    ).toBe(false);
    expect(
      wantsNotification(
        JSON.stringify({ notifications: { 'task.assigned': false } }),
        'task.comment',
      ),
    ).toBe(true);
    expect(
      wantsNotification(JSON.stringify({ notifications: { all: false } }), 'content.comment'),
    ).toBe(false);
  });
  it('maps review audit actions to notification types', () => {
    expect(notificationTypeForAudit('content.approve')).not.toBeUndefined();
    expect(notificationTypeForAudit('unknown.action')).toBeNull();
  });
  it('validates preference patches and merges defaults', () => {
    expect(() => validatePreferencesPatch({ weekStart: 'friday' })).toThrow();
    expect(() => validatePreferencesPatch({ notifications: { 'task.assigned': 'yes' } })).toThrow();
    const ok = validatePreferencesPatch({
      weekStart: 'sunday',
      notifications: { 'task.assigned': false },
    });
    const merged = mergePreferences(JSON.stringify(ok));
    expect(merged.weekStart).toBe('sunday');
    expect(merged.notifications['task.assigned']).toBe(false);
    expect(merged.timezone).toBeTruthy();
  });
});

describe('session + return URL', () => {
  it('only allows in-app return paths', () => {
    expect(safeReturnPath('/app/content?item=1')).toBe('/app/content?item=1');
    expect(safeReturnPath('//evil.com')).toBe('/app');
    expect(safeReturnPath('https://evil.com/app')).toBe('/app');
    expect(safeReturnPath('/app\\..\\evil')).toBe('/app');
    expect(safeReturnPath(null)).toBe('/app');
  });
  it('builds a login URL that preserves the current page', () => {
    expect(loginUrlFor({ pathname: '/app/tasks', search: '?task=9' })).toBe(
      '/login?reason=session&next=%2Fapp%2Ftasks%3Ftask%3D9',
    );
    expect(loginUrlFor({ pathname: '/app', search: '' })).toBe('/login?reason=session');
  });
  it('schedules refresh before expiry', () => {
    const now = Date.parse('2026-10-25T00:00:00Z');
    const in7d = new Date(now + 7 * 86400_000).toISOString();
    const d = refreshDelayMs(in7d, now)!;
    expect(d).toBe(6 * 86400_000);
    expect(refreshDelayMs(new Date(now - 1).toISOString(), now)).toBe(0);
    expect(refreshDelayMs(null, now)).toBeNull();
    const in10m = new Date(now + 600_000).toISOString();
    expect(refreshDelayMs(in10m, now)).toBe(300_000);
  });
  it('derives initials for avatar fallback', () => {
    expect(initials('Osama Abo Sharekh')).toMatch(/^OA|^OS$/);
    expect(initials('')).toBeTruthy();
  });
});

describe('mail provider', () => {
  it('falls back to a no-op adapter and builds reset links', async () => {
    expect(createMailProvider(undefined)).toBeInstanceOf(NoopMailAdapter);
    expect(createMailProvider('unknown')).toBeInstanceOf(NoopMailAdapter);
    await expect(
      new NoopMailAdapter(false).send({ to: 'a@b.c', subject: 's', text: 't' }),
    ).resolves.toBeUndefined();
    expect(passwordResetLink('https://app.example.com/', 'a b')).toBe(
      'https://app.example.com/reset-password?token=a%20b',
    );
  });
});

describe('error states', () => {
  it('classifies api errors', () => {
    expect(errorKindOf({ status: 0, code: 'NETWORK' })).toBe('network');
    expect(errorKindOf({ status: 404 })).toBe('notFound');
    expect(errorKindOf({ status: 503 })).toBe('server');
    expect(errorKindOf({ status: 403 })).toBe('forbidden');
    expect(errorKindOf(new Error('x'))).toBe('generic');
  });
  it('has every new key in en and ar', () => {
    const e = en as Record<string, string>;
    const a = ar as Record<string, string>;
    const prefixes = [
      'errors.page.',
      'account.',
      'auth.forgot.',
      'auth.reset.',
      'session.',
      'legal.',
      'shell.notificationPref.',
      'shell.notificationBody.',
      'settings.notifications.',
    ];
    const keys = Object.keys(e).filter((k) => prefixes.some((p) => k.startsWith(p)));
    expect(keys.length).toBeGreaterThan(60);
    for (const k of keys) expect(a[k], k).toBeTruthy();
  });
});

describe('calm loading UI', () => {
  it('content page uses skeletons, not the dots/top loader', () => {
    const src = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(src).not.toMatch(/OmaTopLoader|OmaDotsLoader/);
    expect(src).toMatch(/ContentShimmer/);
    expect(read('apps/web/src/components/shell/membership-route-gate.tsx')).not.toMatch(
      /OmaDotsLoader/,
    );
  });
  it('skeleton shimmer matches the Home shimmer, has no hard hex and respects reduced motion', () => {
    const css = read('apps/web/src/styles/states.css');
    // Same neutral sweep as antd's active Skeleton used on Home (rgba greys only, no colour).
    expect(css).toMatch(/oma-shimmer-sweep/);
    expect(css).not.toMatch(/gradient\([^)]*#[0-9a-f]{3,8}/i);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(read('apps/web/src/app/globals.css')).not.toMatch(
      /linear-gradient\(90deg, var\(--oma-canvas\)/,
    );
  });
});
