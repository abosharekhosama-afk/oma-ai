import { describe, expect, it } from 'vitest';
import { kpiProgress, kpiWindow, measureKpi, parseKpiTarget } from './kpi-scorecard';

const now = new Date('2026-11-22T12:00:00Z');
const d = (days: number) => new Date(now.getTime() - days * 86_400_000);
const metric = (o: Partial<Record<string, number | null>>) => ({
  impressions: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  views: null,
  engagementRate: null,
  ...o,
});

describe('kpi scorecard', () => {
  it('windows', () => {
    expect(kpiWindow('WEEK', now).from).toEqual(d(7));
    expect(kpiWindow('MONTH', now).days).toBe(30);
    expect(kpiWindow('VERSION', now, d(10)).from).toEqual(d(10));
  });

  it('measures posts and rates; null when there is nothing to measure', () => {
    const w = kpiWindow('WEEK', now);
    const posts = [
      { plannedAt: d(3), publishedAt: d(2) },
      { plannedAt: d(1), publishedAt: null },
      { plannedAt: d(20), publishedAt: d(20) },
    ];
    expect(measureKpi('posts_published', w, posts, [])).toBe(1);
    expect(measureKpi('publish_rate', w, posts, [])).toBe(50);
    expect(measureKpi('publish_rate', w, [], [])).toBeNull();
    expect(measureKpi('impressions', w, posts, [])).toBeNull();
    const rows = [
      metric({ impressions: 100, likes: 3, comments: 1, engagementRate: 0.04 }),
      metric({ impressions: 50, shares: 2, engagementRate: 0.02 }),
    ];
    expect(measureKpi('impressions', w, posts, rows)).toBe(150);
    expect(measureKpi('engagements', w, posts, rows)).toBe(6);
    expect(measureKpi('engagement_rate', w, posts, rows)).toBe(3);
  });

  it('progress and status', () => {
    expect(kpiProgress(null, 10)).toEqual({ progress_pct: null, status: 'no_data' });
    expect(kpiProgress(null, 10, { manual: true }).status).toBe('not_recorded');
    expect(kpiProgress(5, null).status).toBe('no_target');
    expect(kpiProgress(8, 10)).toEqual({ progress_pct: 80, status: 'at_risk' });
    expect(kpiProgress(12, 10).status).toBe('on_track');
    expect(kpiProgress(2, 10).status).toBe('behind');
  });

  it('parses legacy targets', () => {
    expect(parseKpiTarget('1,200 followers')).toBe(1200);
    expect(parseKpiTarget('4.5%')).toBe(4.5);
    expect(parseKpiTarget('grow awareness')).toBeNull();
  });
});
