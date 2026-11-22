import { describe, expect, it } from 'vitest';
import {
  buildCalendarSlots,
  dueBeforePlanned,
  pillarWeights,
  spreadPlannedDates,
} from './calendar-slots';

const cadence = [
  {
    channel: 'Instagram',
    posts_per_week: 3,
    formats: ['Reel', 'Carousel'],
    info_class: 'USER_AUTHORED' as const,
    source: 'MANUAL' as const,
  },
  {
    channel: 'TikTok',
    posts_per_week: 2,
    formats: [],
    info_class: 'USER_AUTHORED' as const,
    source: 'MANUAL' as const,
  },
];

describe('strategy calendar slots (DEC-029 4.2)', () => {
  it('creates posts_per_week slots per channel per week, spread across the week', () => {
    const plan = buildCalendarSlots({
      cadence,
      pillars: [
        { key: 'a', share_target_pct: 50 },
        { key: 'b', share_target_pct: 50 },
      ],
      startDate: '2026-12-07',
      weeks: 2,
      timezone: 'UTC',
    });
    expect(plan.slots).toHaveLength(10);
    const ig = plan.slots.filter((s) => s.channel === 'Instagram' && s.week === 0);
    expect(ig.map((s) => s.planned_at.slice(0, 10))).toEqual([
      '2026-12-07',
      '2026-12-09',
      '2026-12-11',
    ]);
    expect(ig.map((s) => s.format)).toEqual(['Reel', 'Carousel', 'Reel']);
    expect(plan.slots.every((s, i, all) => i === 0 || all[i - 1]!.planned_at <= s.planned_at)).toBe(
      true,
    );
  });

  it('keeps the pillar share split', () => {
    const plan = buildCalendarSlots({
      cadence: [{ ...cadence[0]!, posts_per_week: 5 }],
      pillars: [
        { key: 'edu', share_target_pct: 60 },
        { key: 'offer', share_target_pct: 40 },
      ],
      startDate: '2026-12-07',
      weeks: 4,
      timezone: 'Asia/Dubai',
    });
    const counts = plan.slots.reduce<Record<string, number>>((acc, s) => {
      acc[s.pillar_key!] = (acc[s.pillar_key!] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ edu: 12, offer: 8 });
    // 10:00 Dubai = 06:00 UTC
    expect(plan.slots[0]!.planned_at).toBe('2026-12-07T06:00:00.000Z');
  });

  it('caps slots and flags truncation; clamps weeks', () => {
    const plan = buildCalendarSlots({
      cadence: [{ ...cadence[0]!, posts_per_week: 28 }],
      pillars: [{ key: 'a', share_target_pct: null }],
      startDate: '2026-12-07',
      weeks: 40,
      timezone: 'UTC',
      maxSlots: 50,
    });
    expect(plan.weeks).toBe(12);
    expect(plan.slots).toHaveLength(50);
    expect(plan.truncated).toBe(true);
  });

  it('weights unset pillars with the remaining share, equal when nothing set', () => {
    expect([
      ...pillarWeights([{ key: 'a', share_target_pct: 70 }, { key: 'b' }, { key: 'c' }]).values(),
    ]).toEqual([70, 15, 15]);
    expect([...pillarWeights([{ key: 'a' }, { key: 'b' }]).values()]).toEqual([50, 50]);
    expect([
      ...pillarWeights([{ key: 'a', share_target_pct: 100 }, { key: 'b' }]).values(),
    ]).toEqual([100, 0]);
  });

  it('spreads one-off items and dues work two days ahead, not before start', () => {
    const dates = spreadPlannedDates({
      count: 4,
      startDate: '2026-12-07',
      weeks: 4,
      timezone: 'UTC',
    });
    expect(dates.map((d) => d.slice(0, 10))).toEqual([
      '2026-12-07',
      '2026-12-14',
      '2026-12-21',
      '2026-12-28',
    ]);
    expect(dueBeforePlanned('2026-12-14T12:00:00.000Z', '2026-12-07').toISOString()).toBe(
      '2026-12-12T12:00:00.000Z',
    );
    expect(dueBeforePlanned('2026-12-07T12:00:00.000Z', '2026-12-07').toISOString()).toBe(
      '2026-12-07T00:00:00.000Z',
    );
  });
});
