import { describe, expect, it } from 'vitest';
import {
  actionableFindings,
  expectedPostsInMonth,
  isMonthKey,
  monthWindow,
  monthlyReviewFindings,
  previousMonthKey,
} from './monthly-review';

const empty = {
  month: '2026-10',
  kpis: [],
  channels: [],
  pillars: [],
  flights: [],
  experiments: [],
};

describe('monthly review (DEC-029 4.10)', () => {
  it('month helpers', () => {
    expect(previousMonthKey(new Date('2026-01-15T00:00:00Z'))).toBe('2025-12');
    expect(previousMonthKey(new Date('2026-11-22T10:00:00Z'))).toBe('2026-10');
    expect(isMonthKey('2026-10')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    const w = monthWindow('2026-02');
    expect(w.days).toBe(28);
    expect(w.from.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-02-28T23:59:59.999Z');
    expect(expectedPostsInMonth(3, 31)).toBe(13);
  });

  it('all on track when nothing is actionable', () => {
    const f = monthlyReviewFindings(empty);
    expect(f.map((x) => x.code)).toEqual(['ALL_ON_TRACK']);
    expect(actionableFindings(f)).toEqual([]);
  });

  it('flags KPIs, cadence, drift, pacing and experiments, critical first', () => {
    const f = monthlyReviewFindings({
      ...empty,
      kpis: [
        {
          name: 'Reach',
          source: 'measured',
          status: 'behind',
          actual: 40,
          target_number: 100,
          progress_pct: 40,
        },
        {
          name: 'Leads',
          source: 'manual',
          status: 'not_recorded',
          actual: null,
          target_number: 10,
          progress_pct: null,
        },
      ],
      channels: [
        { channel: 'Instagram', expected: 12, published: 5 },
        { channel: 'TikTok', expected: 4, published: 0 },
        { channel: 'Blog', expected: 4, published: 4 },
      ],
      pillars: [{ key: 'edu', share_target_pct: 50, published_share_pct: 20 }],
      flights: [{ key: 'f1', name: 'Launch', status: 'overspending', pacing_pct: 140 }],
      experiments: [{ name: 'Hook test', status: 'COMPLETED', winner_variant_key: 'B' }],
    });
    expect(f[0]!.severity).toBe('critical');
    const codes = f.map((x) => x.code);
    expect(codes).toContain('KPI_BEHIND');
    expect(codes).toContain('KPI_NOT_RECORDED');
    expect(codes).toContain('CADENCE_SHORTFALL');
    expect(codes).toContain('CADENCE_MISSED');
    expect(codes).not.toContain('ALL_ON_TRACK');
    expect(codes).toContain('PILLAR_DRIFT');
    expect(codes).toContain('FLIGHT_OVERSPENDING');
    expect(codes).toContain('EXPERIMENT_WINNER');
    expect(f.find((x) => x.code === 'CADENCE_SHORTFALL')!.facts.delivery_pct).toBe(42);
    expect(actionableFindings(f).map((x) => x.code)).not.toContain('KPI_NOT_RECORDED');
  });
});
