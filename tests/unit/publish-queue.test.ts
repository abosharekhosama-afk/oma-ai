import { describe, expect, it } from 'vitest';
import {
  clampSlotsPerDay,
  dayNameToDow,
  dowToDayName,
  nextFreeQueueSlot,
  normalizeTimeLocal,
  resolveQueueSlots,
  zonedWallInstant,
} from '@oma/domain';

describe('publish queue helpers', () => {
  it('normalizes clock times and weekday names', () => {
    expect(normalizeTimeLocal('9:05')).toBe('09:05');
    expect(normalizeTimeLocal('24:00')).toBeNull();
    expect(dayNameToDow('Thursday')).toBe(4);
    expect(dowToDayName(0)).toBe('Sunday');
    expect(clampSlotsPerDay(0)).toBe(1);
    expect(clampSlotsPerDay(99)).toBe(10);
  });

  it('merges suggested times with manual overrides and hides disabled matches', () => {
    const resolved = resolveQueueSlots({
      useSuggested: true,
      suggested: [
        { dayOfWeek: 1, timeLocal: '10:00', origin: 'optimal' },
        { dayOfWeek: 1, timeLocal: '14:00', origin: 'optimal' },
      ],
      manual: [
        { dayOfWeek: 1, timeLocal: '10:00', origin: 'manual', enabled: false },
        { dayOfWeek: 1, timeLocal: '18:30', origin: 'manual', enabled: true },
      ],
    });
    expect(resolved.map((s) => s.timeLocal)).toEqual(['14:00', '18:30']);
  });

  it('picks the next free slot after now in the workspace timezone', () => {
    const now = zonedWallInstant('2026-11-09', '09:00', 'Asia/Jerusalem');
    const next = nextFreeQueueSlot({
      now,
      timezone: 'Asia/Jerusalem',
      slotsPerDay: 3,
      slots: [
        { dayOfWeek: 1, timeLocal: '08:00', origin: 'optimal' }, // Monday already passed that week? Nov 9 2026 is Monday
        { dayOfWeek: 1, timeLocal: '10:00', origin: 'optimal' },
        { dayOfWeek: 1, timeLocal: '15:00', origin: 'manual' },
      ],
      occupied: [zonedWallInstant('2026-11-09', '10:00', 'Asia/Jerusalem')],
    });
    expect(next?.timeLocal).toBe('15:00');
    expect(next?.origin).toBe('manual');
  });

  it('skips elapsed hours on the current day', () => {
    const now = zonedWallInstant('2026-11-09', '16:00', 'Asia/Jerusalem');
    const next = nextFreeQueueSlot({
      now,
      timezone: 'Asia/Jerusalem',
      slots: [
        { dayOfWeek: 1, timeLocal: '10:00', origin: 'optimal' },
        { dayOfWeek: 2, timeLocal: '10:00', origin: 'optimal' },
      ],
    });
    expect(next?.dayOfWeek).toBe(2);
    expect(next?.timeLocal).toBe('10:00');
  });
});
