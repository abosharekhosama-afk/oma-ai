import { describe, expect, it } from 'vitest';
import { addDays, monthCursorFromKey, todayKey } from '../../apps/web/src/lib/calendar-today';
import { contentToScheduleRow } from '../../apps/web/src/lib/schedule-production';

describe('production calendar helpers', () => {
  it('returns an ISO calendar day in the workspace timezone', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('derives month cursor from a day key', () => {
    expect(monthCursorFromKey('2026-10-23')).toEqual({ year: 2026, monthIndex: 9 });
  });

  it('adds days without using a capture fixture', () => {
    expect(addDays('2026-10-23', 8)).toBe('2026-10-31');
  });

  it('maps production content onto the schedule board without inventing a date', () => {
    const row = contentToScheduleRow(
      {
        id: 'c1',
        campaignId: 'camp',
        brandId: 'brand',
        title: { en: 'Launch', ar: 'إطلاق' },
        track: 'ORGANIC',
        channel: 'Instagram',
        contentType: 'POST',
        status: 'DRAFT',
        scheduledAt: null,
        plannedAt: null,
        scheduleState: 'UNSCHEDULED',
        approvalState: 'NOT_REQUESTED',
        assignee: 'Owner',
        previewAsset: '',
        deliverableId: null,
      },
      'OPTIONAL',
    );
    expect(row.plannedAt).toBe('');
    expect(row.state).toBe('PLANNED');
    expect(row.externalPublishingConnected).toBe(false);
  });
});
