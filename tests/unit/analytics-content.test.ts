import { describe, expect, it } from 'vitest';
import {
  buildContentOverview,
  delta,
  parseChannels,
  parseGranularity,
  previousRange,
} from '../../apps/api/src/analytics/analytics-content';
import { resolveRange } from '../../apps/api/src/analytics/analytics-range';

const now = new Date('2026-10-26T12:00:00Z');
const range = resolveRange({ period: '7' }, now); // Oct 20 – Oct 26
const d = (s: string) => new Date(s);
const row = (id: string, channel: string, at: string, extra: Record<string, unknown> = {}) => ({
  id,
  brandId: 'b1',
  channel,
  contentType: 'POST',
  status: 'DRAFT',
  titleEn: id,
  titleAr: id,
  captionEn: null,
  captionAr: null,
  previewAssetUrl: null,
  plannedAt: d(at),
  scheduledAt: null,
  createdAt: d('2026-09-01T00:00:00Z'),
  ...extra,
});

describe('analytics content overview', () => {
  it('computes the previous equal-length period', () => {
    const p = previousRange(range);
    expect(p.to.getTime()).toBe(range.from.getTime() - 1);
    expect(p.to.getTime() - p.from.getTime()).toBe(range.to.getTime() - range.from.getTime());
  });
  it('validates granularity and channels', () => {
    expect(parseGranularity(undefined, range)).toBe('day');
    expect(parseGranularity('week', range)).toBe('week');
    expect(() => parseGranularity('hour', range)).toThrow();
    expect(parseChannels('Instagram, linkedin')).toEqual(['instagram', 'linkedin']);
    expect(parseChannels('')).toBeNull();
    expect(() => parseChannels('a;drop')).toThrow();
  });
  it('reports deltas without inventing a baseline', () => {
    expect(delta(10, 5)).toBe(100);
    expect(delta(5, 10)).toBe(-50);
    expect(delta(0, 0)).toBe(0);
    expect(delta(3, 0)).toBeNull();
  });
  it('aggregates KPIs, series, channels and the content table from real rows only', () => {
    const content = [
      row('c1', 'instagram', '2026-10-21T09:00:00Z', {
        status: 'SCHEDULED',
        scheduledAt: d('2026-10-22T09:00:00Z'),
      }),
      row('c2', 'linkedin', '2026-10-23T09:00:00Z'),
      row('old', 'instagram', '2026-10-15T09:00:00Z'),
    ];
    const events = [
      { contentId: 'c1', action: 'APPROVE', at: d('2026-10-21T10:00:00Z') },
      { contentId: 'c2', action: 'REQUEST_CHANGES', at: d('2026-10-23T10:00:00Z') },
      { contentId: 'old', action: 'APPROVE', at: d('2026-10-15T10:00:00Z') },
    ];
    const comments = [
      { contentId: 'c2', createdAt: d('2026-10-24T08:00:00Z') },
      { contentId: 'c2', createdAt: d('2026-10-24T09:00:00Z') },
    ];
    const o = buildContentOverview({
      range,
      granularity: 'day',
      content,
      events,
      comments,
      brandName: () => 'Brand',
    });
    // c1 is dated by scheduledAt (Oct 22), c2 by plannedAt.
    expect(o.kpis.posts).toEqual({ value: 2, previous: 1, delta: 100 });
    expect(o.kpis.approvals).toEqual({ value: 1, previous: 1, delta: 0 });
    expect(o.kpis.comments.value).toBe(2);
    expect(o.kpis.scheduled.value).toBe(1);
    expect(o.series).toHaveLength(7);
    const oct24 = o.series.find((s) => s.bucket === '2026-10-24')!;
    expect(oct24.total.comments).toBe(2);
    expect(oct24.by_channel.linkedin?.comments).toBe(2);
    expect(o.channels.map((c) => c.channel)).toEqual(['instagram', 'linkedin']);
    expect(o.content.rows.map((r) => r.id)).toEqual(['c2', 'c1']);
    expect(o.content.rows[0]).toMatchObject({ comments: 2, changes_requested: 1 });
    expect(o.content.totals).toEqual({ comments: 2, approvals: 1, changes_requested: 1 });
    expect(o.top_content.comments.map((r) => r.id)).toEqual(['c2']);
    expect(o.social.connected).toBe(false);
    expect(JSON.stringify(o)).not.toMatch(/impressions":\s*\d|followers":\s*\d/);
  });
  it('buckets weekly from Monday', () => {
    const r = resolveRange({ period: '30' }, now);
    const o = buildContentOverview({
      range: r,
      granularity: 'week',
      content: [row('c1', 'x', '2026-10-21T09:00:00Z')],
      events: [],
      comments: [],
      brandName: () => '',
    });
    expect(o.series.every((s) => new Date(`${s.bucket}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
    expect(o.series.find((s) => s.bucket === '2026-10-19')!.total.posts).toBe(1);
  });
});

import {
  chartPoints,
  deltaTone,
  matchesContentFilter,
  overviewQuery,
  toCsv,
} from '../../apps/web/src/lib/analytics-api';

describe('analytics overview client helpers', () => {
  it('builds the overview query with channels and granularity', () => {
    expect(
      overviewQuery({ period: '30', channels: ['linkedin', 'instagram'], granularity: 'week' }),
    ).toBe('period=30&channels=instagram%2Clinkedin&granularity=week');
    expect(overviewQuery({ period: '7', brandId: 'b', campaignId: 'c' })).toBe(
      'period=7&brandId=b',
    );
  });
  it('mirrors chart x positions in RTL', () => {
    expect(chartPoints([0, 5, 10], 100, 50, 10)).toEqual([
      [0, 50],
      [50, 25],
      [100, 0],
    ]);
    expect(chartPoints([0, 5, 10], 100, 50, 10, true).map((p) => p[0])).toEqual([100, 50, 0]);
  });
  it('groups content types like Planable and tones deltas', () => {
    expect(matchesContentFilter('REEL', 'videos')).toBe(true);
    expect(matchesContentFilter('STORY', 'posts')).toBe(false);
    expect(matchesContentFilter('CAROUSEL', 'posts')).toBe(true);
    expect(deltaTone(null)).toBe('none');
    expect(deltaTone(-2)).toBe('down');
  });
  it('writes CSV with quoting and a BOM for Arabic', () => {
    const csv = toCsv([
      ['a', 'b,c'],
      ['say "hi"', 'مرحبا'],
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"b,c"');
    expect(csv).toContain('"say ""hi"""');
  });
});
