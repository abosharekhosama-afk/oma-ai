import { describe, expect, it } from 'vitest';
import {
  defaultHolidayCalendarsForTimezone,
  holidayMapForCalendars,
  holidaysForCalendars,
  parseHolidayCalendarIds,
  resolveHolidayCalendarIds,
} from './holiday-calendars';

describe('holiday calendars', () => {
  it('maps workspace timezone to a regional calendar', () => {
    expect(defaultHolidayCalendarsForTimezone('Asia/Jerusalem')).toEqual(['il']);
    expect(defaultHolidayCalendarsForTimezone('America/New_York')).toEqual(['us']);
    expect(defaultHolidayCalendarsForTimezone('Asia/Riyadh')).toEqual(['sa']);
    expect(defaultHolidayCalendarsForTimezone('UTC')).toEqual(['intl']);
  });

  it('uses stored selection when present, otherwise timezone default', () => {
    expect(resolveHolidayCalendarIds('["us","intl"]', 'Asia/Jerusalem')).toEqual(['us', 'intl']);
    expect(resolveHolidayCalendarIds('[]', 'Asia/Jerusalem')).toEqual(['il']);
    expect(parseHolidayCalendarIds('["nope", "il", "il"]')).toEqual(['il']);
  });

  it('returns real dated holidays for the selected region', () => {
    const il = holidaysForCalendars(['il'], '2026-04-01', '2026-04-30');
    expect(il.some((h) => h.date === '2026-04-22' && h.nameEn === 'Independence Day')).toBe(true);
    const us = holidayMapForCalendars(['us'], 'en');
    expect(us['2026-11-03']).toContain('Election Day');
    const chips = holidayMapForCalendars(['intl'], 'ar');
    expect(chips['2026-12-25']).toBe('عيد الميلاد');
  });
});
