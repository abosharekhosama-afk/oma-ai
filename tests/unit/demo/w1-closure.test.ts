import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertCanSchedule, resolveContentWorkflow } from '@oma/demo';
import {
  bucketForScheduleRow,
  displayForScheduleBucket,
} from '../../../apps/web/src/lib/demo/stage6-schedule';

describe('W1 closure contracts', () => {
  it('pins calendar cards to Planable cell-contained chrome', () => {
    const css = readFileSync('apps/web/src/styles/stage3.css', 'utf8');
    // LIVE_VERIFIED rebuild: cards fluidly fill the day cell (not a fixed 126×172 box).
    expect(css).toContain('.oma-cal-cell .oma-post-card--calendar');
    expect(css).toContain('max-width: 100%');
    expect(css).toContain('min-height: 120px');
    expect(css).toContain('padding: 6px');
    expect(css).toContain('border-radius: 8px');
    expect(css).toContain('150ms ease-out');
    expect(css).toContain('#e2e3e5');
  });

  it('maps each schedule bucket to a distinct honest display', () => {
    expect(displayForScheduleBucket('planned')).toBe('PLANNED_DATE');
    expect(displayForScheduleBucket('scheduled')).toBe('SCHEDULED_LOCAL');
    expect(displayForScheduleBucket('approval_blocked')).toBe('PARTIALLY_APPROVED');
    expect(displayForScheduleBucket('publishing_not_connected')).toBe('PUBLISHING_NOT_CONNECTED');
    const card = readFileSync('apps/web/src/components/content/content-card.tsx', 'utf8');
    expect(card).toContain("display === 'SCHEDULED_LOCAL'");
    expect(card).not.toContain("display === 'APPROVED' || display === 'SCHEDULED_LOCAL'");
  });

  it('keeps a planned date out of the scheduled bucket', () => {
    expect(
      bucketForScheduleRow({
        plannedAt: '2026-09-18T10:00:00+03:00',
        state: 'PLANNED',
      } as never),
    ).toBe('planned');
    expect(
      bucketForScheduleRow({
        plannedAt: '2026-09-18T10:00:00+03:00',
        state: 'SCHEDULED_PREVIEW',
      } as never),
    ).toBe('scheduled');
    expect(
      bucketForScheduleRow({
        plannedAt: '2026-09-18T10:00:00+03:00',
        state: 'BLOCKED',
        readiness: [{ kind: 'approval', ok: false }],
      } as never),
    ).toBe('approval_blocked');
    expect(
      bucketForScheduleRow({
        plannedAt: '2026-09-18T10:00:00+03:00',
        state: 'BLOCKED',
        readiness: [{ kind: 'channel', ok: false }],
      } as never),
    ).toBe('planned');
  });

  it('blocks a partial approval under REQUIRED and OPTIONAL; NONE allows schedule', () => {
    const item = {
      status: 'IN_REVIEW',
      scheduledAt: '2026-10-01T09:00:00.000Z',
      scheduleState: 'UNSCHEDULED' as const,
      approverApproved: 1,
      approverRequired: 2,
    };
    const required = resolveContentWorkflow(item, 'REQUIRED');
    expect(required.approvalState).toBe('PARTIALLY_APPROVED');
    expect(assertCanSchedule(required)).toBe('APPROVAL_REQUIRED');
    const optional = resolveContentWorkflow(item, 'OPTIONAL');
    expect(assertCanSchedule(optional)).toBe('APPROVAL_REQUIRED');
    const none = resolveContentWorkflow(item, 'NONE');
    expect(assertCanSchedule(none)).toBe('OK');
  });
});
