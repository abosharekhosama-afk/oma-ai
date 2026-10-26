import { describe, expect, it } from 'vitest';

import {
  CAL_DISPLAY_KEY,
  decideDrop,
  isWeekendKey,
  isoWeekNumber,
  neighbourId,
  parseContentUrl,
  previewStep,
  sanitizeCalendarDisplay,
  shiftDayKey,
  stepCalendar,
  weekKeys,
  weekStartKey,
  writeContentUrl,
} from '../../apps/web/src/lib/content-views';

describe('content-views dates', () => {
  it('computes ISO week numbers', () => {
    expect(isoWeekNumber('2026-10-26')).toBe(44);
    expect(isoWeekNumber('2026-01-01')).toBe(1);
    expect(isoWeekNumber('2027-01-01')).toBe(53);
  });
  it('shifts and steps across months and years', () => {
    expect(shiftDayKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(stepCalendar('2026-10-26', 'week', 1)).toBe('2026-11-02');
    expect(stepCalendar('2026-10-26', 'week', -1)).toBe('2026-10-19');
    expect(stepCalendar('2026-12-15', 'month', 1)).toBe('2027-01-01');
    expect(stepCalendar('2026-01-15', 'month', -1)).toBe('2025-12-01');
  });
  it('finds week starts for Monday, Sunday and Saturday weeks', () => {
    expect(weekStartKey('2026-10-28', 1)).toBe('2026-10-26');
    expect(weekStartKey('2026-10-28', 0)).toBe('2026-10-25');
    expect(weekStartKey('2026-10-28', 6)).toBe('2026-10-24');
    const keys = weekKeys('2026-10-28', 1);
    expect(keys).toHaveLength(7);
    expect(keys[6]).toBe('2026-11-01');
    expect(isWeekendKey('2026-10-31')).toBe(true);
    expect(isWeekendKey('2026-10-28')).toBe(false);
  });
});

describe('content-views drag and drop', () => {
  const base = { status: 'DRAFT', scheduleState: 'NOT_SCHEDULED', approvalState: 'NOT_REQUESTED' };
  it('ignores same-day drops and published posts', () => {
    expect(decideDrop(base as never, '2026-10-01', '2026-10-01', 'NONE')).toEqual({
      ok: false,
      reason: 'SAME_DAY',
    });
    expect(
      decideDrop({ ...base, status: 'PUBLISHED' } as never, '2026-10-01', '2026-10-02', 'NONE'),
    ).toEqual({ ok: false, reason: 'PUBLISHED' });
  });
  it('plans unscheduled posts and reschedules scheduled ones', () => {
    expect(decideDrop(base as never, null, '2026-10-02', 'REQUIRED')).toEqual({
      ok: true,
      mode: 'plan',
    });
    const sched = { ...base, scheduleState: 'SCHEDULED' };
    expect(decideDrop(sched as never, '2026-10-01', '2026-10-02', 'OPTIONAL')).toEqual({
      ok: true,
      mode: 'reschedule',
    });
    expect(decideDrop(sched as never, '2026-10-01', '2026-10-02', 'REQUIRED')).toEqual({
      ok: false,
      reason: 'APPROVAL_REQUIRED',
    });
    expect(
      decideDrop(
        { ...sched, approvalState: 'APPROVED' } as never,
        '2026-10-01',
        '2026-10-02',
        'REQUIRED',
      ),
    ).toEqual({ ok: true, mode: 'reschedule' });
  });
});

describe('content-views preview navigation', () => {
  it('mirrors left/right in RTL', () => {
    expect(previewStep('ArrowLeft', 'ltr')).toBe(-1);
    expect(previewStep('ArrowRight', 'ltr')).toBe(1);
    expect(previewStep('ArrowLeft', 'rtl')).toBe(1);
    expect(previewStep('ArrowRight', 'rtl')).toBe(-1);
    expect(previewStep('ArrowUp', 'rtl')).toBe(-1);
    expect(previewStep('ArrowDown', 'ltr')).toBe(1);
    expect(previewStep('Enter', 'ltr')).toBe(0);
  });
  it('finds neighbours within bounds', () => {
    const ids = ['a', 'b', 'c'];
    expect(neighbourId(ids, 'b', 1)).toBe('c');
    expect(neighbourId(ids, 'b', -1)).toBe('a');
    expect(neighbourId(ids, 'c', 1)).toBeNull();
    expect(neighbourId(ids, 'x', 1)).toBeNull();
    expect(neighbourId(ids, null, 1)).toBeNull();
  });
});

describe('content-views URL state', () => {
  it('parses with safe defaults', () => {
    expect(parseContentUrl('')).toEqual({
      view: 'calendar',
      item: null,
      span: 'month',
      date: null,
      approvals: false,
    });
    expect(parseContentUrl('view=grid&item=c1&span=week&date=2026-10-26&approvals=mine')).toEqual({
      view: 'grid',
      item: 'c1',
      span: 'week',
      date: '2026-10-26',
      approvals: true,
    });
    expect(parseContentUrl('view=bogus&date=26-10-2026').view).toBe('calendar');
    expect(parseContentUrl('date=26-10-2026').date).toBeNull();
  });
  it('round-trips and keeps unrelated params', () => {
    const p = new URLSearchParams('campaign=x&span=week');
    writeContentUrl(p, { view: 'list', span: 'month', approvals: true, item: null });
    expect(p.get('campaign')).toBe('x');
    expect(p.get('span')).toBeNull();
    expect(p.get('approvals')).toBe('mine');
    expect(parseContentUrl(p).view).toBe('list');
  });
});

describe('calendar display settings', () => {
  it('sanitizes garbage to defaults', () => {
    expect(CAL_DISPLAY_KEY).toMatch(/v1$/);
    const d = sanitizeCalendarDisplay('nope', 'en');
    expect(d.postSize).toBe('default');
    const bad = sanitizeCalendarDisplay(
      { postSize: 'huge', weekStartsOn: 3, elements: ['x'] },
      'en',
    );
    expect(bad.postSize).toBe('default');
    expect([0, 1, 6]).toContain(bad.weekStartsOn);
    expect(bad.elements).not.toContain('x');
    const ok = sanitizeCalendarDisplay({ postSize: 'compact', showWeekends: false }, 'en');
    expect(ok.postSize).toBe('compact');
    expect(ok.showWeekends).toBe(false);
  });
});
