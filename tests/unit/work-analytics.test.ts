import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYSTEM_PROFILES } from '../../packages/domain/src/authz/capabilities';
import {
  approvalStats,
  bucketKeys,
  rate,
  resolveRange,
} from '../../apps/api/src/analytics/analytics-range';
import {
  analyticsQuery,
  formatHours,
  formatRate,
  niceMax,
} from '../../apps/web/src/lib/analytics-api';
import en from '../../packages/i18n/messages/en.json';
import ar from '../../packages/i18n/messages/ar.json';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const now = new Date('2026-10-25T12:00:00Z');

describe('analytics range', () => {
  it('resolves preset periods ending now with daily buckets', () => {
    const r = resolveRange({ period: '7' }, now);
    expect(r.days).toBe(7);
    expect(r.bucket).toBe('day');
    expect(r.from.toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(bucketKeys(r)).toHaveLength(7);
    expect(resolveRange({}, now).days).toBe(30);
  });
  it('uses weekly buckets beyond 31 days and validates custom ranges', () => {
    const r = resolveRange({ period: '90' }, now);
    expect(r.bucket).toBe('week');
    expect(bucketKeys(r).every((k) => new Date(k).getUTCDay() === 1)).toBe(true);
    const c = resolveRange({ from: '2026-10-01', to: '2026-10-01' }, now);
    expect(c.days).toBe(1);
    expect(() => resolveRange({ period: '14' }, now)).toThrow();
    expect(() => resolveRange({ from: '2026-10-01' }, now)).toThrow();
    expect(() => resolveRange({ from: '2026-10-05', to: '2026-10-01' }, now)).toThrow();
    expect(() => resolveRange({ from: '10/01/2026', to: '2026-10-02' }, now)).toThrow();
  });
});

describe('approval stats', () => {
  const at = (h: number) => new Date(now.getTime() - (48 - h) * 3600_000);
  const range = { from: new Date(now.getTime() - 7 * 86400_000), to: now };
  it('computes time to approval, revision rounds and rejection rate', () => {
    const s = approvalStats(
      [
        { itemId: 'a', action: 'REQUEST', at: at(0) },
        { itemId: 'a', action: 'REQUEST_CHANGES', at: at(2) },
        { itemId: 'a', action: 'REQUEST', at: at(3) },
        { itemId: 'a', action: 'APPROVE', at: at(10) },
        { itemId: 'b', action: 'REQUEST', at: at(0) },
        { itemId: 'b', action: 'REJECT', at: at(1) },
        { itemId: 'c', action: 'REQUEST', at: at(5) },
      ],
      range,
    );
    expect(s).toMatchObject({
      submitted: 4,
      approved: 1,
      rejected: 1,
      changes_requested: 1,
      avg_hours_to_approval: 10,
      avg_revision_rounds: 0.5,
      rejection_rate: 50,
    });
  });
  it('returns nulls (not NaN/0) when nothing was decided', () => {
    const s = approvalStats([], range);
    expect(s.avg_hours_to_approval).toBeNull();
    expect(s.rejection_rate).toBeNull();
    expect(rate(0, 0)).toBeNull();
  });
});

describe('analytics web helpers', () => {
  it('builds queries for presets, custom ranges and filters', () => {
    expect(analyticsQuery({ period: '7' })).toBe('period=7');
    expect(
      analyticsQuery({
        period: 'custom',
        from: '2026-01-01',
        to: '2026-01-31',
        brandId: 'b',
        campaignId: 'c',
      }),
    ).toBe('from=2026-01-01&to=2026-01-31&brandId=b&campaignId=c');
    expect(analyticsQuery({ period: 'custom' })).toBe('period=30');
  });
  it('formats durations, rates and axis maxima', () => {
    expect(formatHours(null, 'en')).toBe('—');
    expect(formatHours(5, 'en')).toBe('5h');
    expect(formatHours(72, 'en')).toBe('3d');
    expect(formatRate(33.3, 'en')).toBe('33.3%');
    expect(niceMax([0, 0])).toBe(4);
    expect(niceMax([7])).toBe(10);
    expect(niceMax([23])).toBe(25);
  });
});

describe('analytics permission + page', () => {
  it('grants analytics.read to team profiles, not to clients/guests', () => {
    for (const p of ['COMPANY_OWNER', 'ADMIN', 'WRITER', 'APPROVER', 'MEMBER', 'VIEWER']) {
      expect(SYSTEM_PROFILES[p], p).toContain('analytics.read');
    }
    expect(SYSTEM_PROFILES.CLIENT).not.toContain('analytics.read');
    expect(SYSTEM_PROFILES.GUEST).not.toContain('analytics.read');
    expect(read('apps/api/src/common/guards/capabilities.guard.ts')).toContain(
      "'GET /api/v1/analytics': ['analytics.read']",
    );
    expect(
      read('packages/db/prisma/migrations/20261025210000_analytics_read_capability/migration.sql'),
    ).toContain("'analytics.read'");
  });
  it('uses the real API (no demo data, disclosure or badges) and notes social is not connected', () => {
    const src = read('apps/web/src/app/(app)/app/analytics/analytics-client.tsx');
    expect(src).not.toMatch(/demoApi|DemoDisclosure|demo-analytics|sample-badge/);
    expect(src).toContain('getWorkAnalytics');
    expect(src).toContain('analytics.socialNotConnected');
    expect(src).toContain('AnalyticsSkeleton');
    expect(src).toContain('ErrorState');
  });
  it('styles with tokens only — no gradients, glows, hex or purple', () => {
    const css = read('apps/web/src/styles/work-analytics.css');
    expect(css).not.toMatch(/gradient|#[0-9a-f]{3,8}\b|violet|purple|blur\(/i);
  });
  it('has every analytics key in en and ar', () => {
    const e = en as Record<string, string>;
    const a = ar as Record<string, string>;
    const keys = Object.keys(e).filter((k) => k.startsWith('analytics.'));
    expect(keys.length).toBeGreaterThan(50);
    for (const k of keys) expect(a[k], k).toBeTruthy();
  });
});
