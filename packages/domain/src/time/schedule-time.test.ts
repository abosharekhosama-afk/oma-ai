import { describe, expect, it } from 'vitest';
import { parseScheduleInstant, wallTimeToIso } from './schedule-time';

describe('schedule-time', () => {
  it('wallTimeToIso builds a real ISO instant in the brand timezone', () => {
    expect(wallTimeToIso('2026-10-28T14:30', 'Asia/Dubai')).toBe('2026-10-28T10:30:00.000Z');
    expect(wallTimeToIso('2026-10-28', 'Asia/Dubai')).toBe('2026-10-28T06:00:00.000Z');
    expect(wallTimeToIso('2026-07-01 09:00', 'Asia/Jerusalem')).toBe('2026-07-01T06:00:00.000Z');
  });

  it('parseScheduleInstant accepts wall time and absolute ISO', () => {
    const wall = parseScheduleInstant('2026-10-28T14:30', 'Asia/Dubai');
    expect(wall?.toISOString()).toBe('2026-10-28T10:30:00.000Z');
    const abs = parseScheduleInstant('2026-10-28T10:30:00.000Z', 'Asia/Dubai');
    expect(abs?.toISOString()).toBe('2026-10-28T10:30:00.000Z');
  });
});
