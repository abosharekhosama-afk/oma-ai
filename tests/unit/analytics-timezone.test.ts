import { describe, expect, it } from 'vitest';
import { bucketKey, bucketKeys, resolveRange } from '../../apps/api/src/analytics/analytics-range';
import { buildContentOverview } from '../../apps/api/src/analytics/analytics-content';
import { dayKey, tzOffsetMs, zonedMidnight } from '../../apps/api/src/common/zoned-time';
import { bucketWeek } from '../../apps/web/src/lib/home-view-model';

const JLM = 'Asia/Jerusalem';
const H = 3600_000;

describe('zoned time (Asia/Jerusalem DST: UTC+3 → UTC+2 on 2026-10-25)', () => {
  it('finds local midnights on both sides of the change', () => {
    expect(zonedMidnight('2026-10-24', JLM).toISOString()).toBe('2026-10-23T21:00:00.000Z');
    expect(zonedMidnight('2026-10-25', JLM).toISOString()).toBe('2026-10-24T21:00:00.000Z');
    expect(zonedMidnight('2026-10-26', JLM).toISOString()).toBe('2026-10-25T22:00:00.000Z');
    // The DST day is 25 hours long.
    expect(
      zonedMidnight('2026-10-26', JLM).getTime() - zonedMidnight('2026-10-25', JLM).getTime(),
    ).toBe(25 * H);
    expect(tzOffsetMs(new Date('2026-10-24T12:00:00Z'), JLM)).toBe(3 * H);
    expect(tzOffsetMs(new Date('2026-10-26T12:00:00Z'), JLM)).toBe(2 * H);
  });

  it('spring forward day (2026-03-27) is 23 hours', () => {
    expect(
      zonedMidnight('2026-03-28', JLM).getTime() - zonedMidnight('2026-03-27', JLM).getTime(),
    ).toBe(23 * H);
  });

  it('assigns instants near local midnight to the local day, not the UTC day', () => {
    // 00:30 local on Oct 26 (UTC+2) is still Oct 25 in UTC.
    expect(dayKey(new Date('2026-10-25T22:30:00Z'), JLM)).toBe('2026-10-26');
    // 00:30 local on Oct 25 (UTC+3).
    expect(dayKey(new Date('2026-10-24T21:30:00Z'), JLM)).toBe('2026-10-25');
  });
});

describe('analytics range in brand timezone', () => {
  it('custom range spans local days across DST', () => {
    const r = resolveRange({ from: '2026-10-24', to: '2026-10-26' }, new Date(), JLM);
    expect(r.from.toISOString()).toBe('2026-10-23T21:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-26T21:59:59.999Z');
    expect(r.days).toBe(3);
    expect(bucketKeys(r)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
  });

  it('period ending now starts at local midnight N-1 days ago', () => {
    const now = new Date('2026-10-26T01:00:00Z'); // 03:00 local Oct 26
    const r = resolveRange({ period: '7' }, now, JLM);
    expect(r.from.toISOString()).toBe('2026-10-19T21:00:00.000Z'); // Oct 20 00:00 (UTC+3)
    expect(bucketKeys(r)).toHaveLength(7);
    expect(bucketKeys(r)[6]).toBe('2026-10-26');
  });

  it('weekly buckets start on local Monday', () => {
    // Monday Oct 26 00:30 local = Sunday 22:30 UTC.
    expect(bucketKey(new Date('2026-10-25T22:30:00Z'), 'week', JLM)).toBe('2026-10-26');
    expect(bucketKey(new Date('2026-10-25T22:30:00Z'), 'week', 'UTC')).toBe('2026-10-19');
  });

  it('UTC default is unchanged', () => {
    const r = resolveRange({ from: '2026-10-01', to: '2026-10-31' }, new Date());
    expect(r.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(r.days).toBe(31);
  });

  it('content overview buckets a post at 00:30 local into that local day', () => {
    const range = resolveRange({ from: '2026-10-24', to: '2026-10-26' }, new Date(), JLM);
    const o = buildContentOverview({
      range,
      granularity: 'day',
      content: [
        {
          id: 'p1',
          brandId: 'b1',
          channel: 'instagram',
          contentType: 'POST',
          status: 'SCHEDULED',
          titleEn: 'p1',
          titleAr: 'p1',
          captionEn: null,
          captionAr: null,
          previewAssetUrl: null,
          scheduledAt: new Date('2026-10-25T22:30:00Z'),
          plannedAt: null,
          createdAt: new Date('2026-10-25T22:30:00Z'),
        },
      ],
      events: [],
      comments: [{ contentId: 'p1', createdAt: new Date('2026-10-24T21:30:00Z') }],
      brandName: () => 'Brand',
    } as Parameters<typeof buildContentOverview>[0]);
    expect(o.range.timezone).toBe(JLM);
    expect(o.series.map((s) => s.bucket)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26']);
    expect(o.series.find((s) => s.bucket === '2026-10-26')!.total.posts).toBe(1);
    expect(o.series.find((s) => s.bucket === '2026-10-25')!.total.comments).toBe(1);
  });
});

describe('home week strip in scheduling timezone', () => {
  it('uses the API calendar days and item day keys', () => {
    const items = [
      {
        id: 'a',
        title: { en: 'a', ar: 'a' },
        channel: 'x',
        brand: null,
        scheduled_at: '2026-10-25T22:30:00.000Z',
        day: '2026-10-26',
        thumbnail_url: null,
        href: '#',
      },
    ];
    const days = Array.from({ length: 7 }, (_, i) => `2026-10-${String(26 + i).padStart(2, '0')}`);
    const week = bucketWeek(items, new Date('2026-10-25T22:40:00Z'), { days, timezone: JLM });
    expect(week[0]!.key).toBe('2026-10-26');
    expect(week[0]!.items.map((i) => i.id)).toEqual(['a']);
  });

  it('derives day keys in the timezone when the API omits them', () => {
    const items = [
      {
        id: 'b',
        title: { en: 'b', ar: 'b' },
        channel: 'x',
        brand: null,
        scheduled_at: '2026-10-25T22:30:00.000Z',
        thumbnail_url: null,
        href: '#',
      },
    ];
    const week = bucketWeek(items, new Date('2026-10-25T22:40:00Z'), { timezone: JLM });
    expect(week[0]!.key).toBe('2026-10-26');
    expect(week[0]!.items).toHaveLength(1);
  });
});
