import { describe, expect, it } from 'vitest';
import {
  computePageOptimalTimes,
  confidenceFromSamples,
  engagementRate,
  excludeElapsedHours,
  heatmapMatrix,
  industryPrior,
  localWeekdayHour,
  OPTIMAL_TIMES_KAPPA,
  parsePostInsights,
  pickTopSlots,
  recencyWeight,
  shrinkScore,
  snapshotMetricsFromInsights,
} from '@oma/domain';

describe('optimal send times scoring', () => {
  it('parses insights and computes engagement rate (eq 1)', () => {
    expect(parsePostInsights('nope')).toBeNull();
    expect(parsePostInsights(null)).toBeNull();
    const parsed = parsePostInsights(
      '{"impressions": 200, "reach": 100, "likes": 8, "comments": 2, "shares": 0, "fetchedAt": "t"}',
    );
    expect(snapshotMetricsFromInsights(parsed!)).toMatchObject({
      engagements: 10,
      engagementRate: 0.05,
    });
    expect(engagementRate({ likes: 3, comments: 1, shares: 1, reach: 10, impressions: 20 })).toBe(
      0.25,
    );
    expect(engagementRate({ likes: 4, comments: 1, shares: 0 })).toBeNull();
  });

  it('decays recency with a 28-day half-life (eq 2)', () => {
    expect(recencyWeight(0)).toBe(1);
    expect(recencyWeight(28)).toBeCloseTo(0.5, 8);
    expect(recencyWeight(56)).toBeCloseTo(0.25, 8);
  });

  it('shrinks toward the prior and reports confidence (eq 3)', () => {
    expect(shrinkScore(0, 0.9, 0.2)).toBeCloseTo(0.2);
    expect(shrinkScore(1000, 0.9, 0.2)).toBeGreaterThan(0.85);
    expect(confidenceFromSamples(0)).toBe(0);
    expect(confidenceFromSamples(OPTIMAL_TIMES_KAPPA)).toBeCloseTo(0.5);
    expect(confidenceFromSamples(24)).toBeGreaterThan(0.7);
  });

  it('maps publishedAt into Sunday=0 weekday/hour in the workspace timezone', () => {
    const tz = 'Asia/Jerusalem';
    // 23:30 Sunday local (UTC+2) on 8 Nov 2026.
    const sunday = localWeekdayHour(new Date('2026-11-08T21:30:00Z'), tz);
    expect(sunday.dayOfWeek).toBe(0);
    expect(sunday.hourLocal).toBe(23);
    expect(sunday.dayKey).toBe('2026-11-08');
    // 00:30 Monday local.
    const monday = localWeekdayHour(new Date('2026-11-08T22:30:00Z'), tz);
    expect(monday.dayOfWeek).toBe(1);
    expect(monday.hourLocal).toBe(0);
    expect(monday.dayKey).toBe('2026-11-09');
  });

  it('uses industry priors for a cold start and spaces top slots by two hours', () => {
    const empty = computePageOptimalTimes({
      snapshots: [],
      network: 'instagram',
      timezone: 'Asia/Dubai',
      now: new Date('2026-11-09T10:00:00Z'),
    });
    expect(empty.status).toBe('no_data');
    expect(empty.sample_size).toBe(0);
    expect(empty.cells).toHaveLength(168);
    const evening = empty.cells.find((c) => c.day_of_week === 1 && c.hour_local === 19)!;
    const dawn = empty.cells.find((c) => c.day_of_week === 1 && c.hour_local === 3)!;
    expect(evening.score).toBeCloseTo(industryPrior('instagram', 1, 19));
    expect(evening.score).toBeGreaterThan(dawn.score);
    expect(empty.slots.filter((s) => s.day_of_week === 1)).toHaveLength(7);

    const packed = pickTopSlots(
      [10, 11, 12, 18].map((hour) => ({ day_of_week: 2, hour_local: hour, score: 20 - hour })),
    );
    expect(packed.map((p) => p.hour_local)).toEqual([10, 12, 18]);
  });

  it('weights recent posts more and ignores a viral outlier', () => {
    const now = new Date('2026-11-09T12:00:00Z');
    const tz = 'UTC';
    const base = Array.from({ length: 12 }, (_) => ({
      publishedAt: new Date('2026-11-02T10:00:00Z'),
      impressions: 100,
      reach: 100,
      likes: 5,
      comments: 0,
      shares: 0,
    }));
    const recentPeak = {
      publishedAt: new Date('2026-11-09T18:00:00Z'),
      impressions: 100,
      reach: 100,
      likes: 20,
      comments: 5,
      shares: 0,
    };
    const oldPeak = {
      publishedAt: new Date('2026-08-01T18:00:00Z'),
      impressions: 100,
      reach: 100,
      likes: 80,
      comments: 10,
      shares: 0,
    };
    const viral = {
      publishedAt: new Date('2026-11-03T11:00:00Z'),
      impressions: 100,
      reach: 100,
      likes: 800,
      comments: 50,
      shares: 20,
    };
    const result = computePageOptimalTimes({
      snapshots: [...base, recentPeak, oldPeak, viral],
      network: 'instagram',
      timezone: tz,
      now,
    });
    expect(result.status).toBe('low_data');
    const hour18 = result.cells.find((c) => c.day_of_week === 1 && c.hour_local === 18)!;
    // Monday 9 Nov 18:00 UTC is weekday 1. Recent peak should lift that cell above a random base hour.
    const hour10 = result.cells.find((c) => c.day_of_week === 1 && c.hour_local === 10)!;
    expect(hour18.score).toBeGreaterThan(hour10.score);
    // Viral 11:00 cell should not dominate after the 4σ filter.
    const hour11 = result.cells.find((c) => c.hour_local === 11 && c.n > 0);
    if (hour11) expect(hour11.n).toBeLessThan(3);
  });

  it('drops elapsed hours when suggesting times for today', () => {
    const slots = [9, 14, 20].map((hour, i) => ({
      day_of_week: 1,
      hour_local: hour,
      minute_of_day: hour * 60,
      rank: i + 1,
      score: 1 - i * 0.1,
      confidence: 0.5,
      n: 4,
      source: 'model' as const,
      label: 'medium' as const,
    }));
    const kept = excludeElapsedHours(slots, {
      dateKey: '2026-11-09',
      now: new Date('2026-11-09T13:15:00Z'),
      timezone: 'UTC',
    });
    expect(kept.map((s) => s.hour_local)).toEqual([14, 20]);
    expect(kept[0]?.rank).toBe(1);
  });

  it('builds a 7x24 heatmap matrix for both metrics', () => {
    const computed = computePageOptimalTimes({
      snapshots: [
        {
          publishedAt: new Date('2026-11-09T18:00:00Z'),
          impressions: 50,
          likes: 10,
          comments: 0,
          shares: 0,
        },
      ],
      network: 'x',
      timezone: 'UTC',
      now: new Date('2026-11-09T20:00:00Z'),
    });
    const rate = heatmapMatrix(computed.cells, 'rate');
    const volume = heatmapMatrix(computed.cells, 'engagements');
    expect(rate).toHaveLength(7);
    expect(rate[0]).toHaveLength(24);
    expect(volume[1]![18]!.score).toBeGreaterThan(0);
  });
});
