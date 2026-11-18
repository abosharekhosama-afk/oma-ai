import { describe, expect, it } from 'vitest';
import {
  accountBlockers,
  calendarPlacement,
  evaluateMediaScheduleBlockers,
  evaluateScheduleReadiness,
  mergeScheduleReadiness,
  postScheduleBlockers,
  scheduleRequiresConnectedAccount,
  type ScheduleReadinessInput,
} from './schedule-readiness';

const base = (over: Partial<ScheduleReadinessInput> = {}): ScheduleReadinessInput => ({
  workflow: { status: 'DRAFT', scheduledAt: null, approvalState: 'NOT_REQUESTED' },
  policy: 'OPTIONAL',
  channel: 'instagram',
  targets: [{ socialPageId: 'p1', network: 'INSTAGRAM', status: 'CONNECTED' }],
  requireConnectedAccount: true,
  ...over,
});

describe('evaluateMediaScheduleBlockers', () => {
  it('requires media for Instagram feed posts', () => {
    const blockers = evaluateMediaScheduleBlockers({
      channel: 'instagram',
      targets: [{ socialPageId: 'p1', network: 'INSTAGRAM', status: 'CONNECTED' }],
      contentType: 'POST',
      media: [],
    });
    expect(blockers.map((b) => b.code)).toContain('MEDIA_REQUIRED');
  });

  it('passes when a photo is attached', () => {
    const blockers = evaluateMediaScheduleBlockers({
      channel: 'instagram',
      targets: [{ socialPageId: 'p1', network: 'INSTAGRAM', status: 'CONNECTED' }],
      contentType: 'POST',
      media: [{ mime: 'image/jpeg', sizeBytes: 1000 }],
    });
    expect(blockers).toEqual([]);
  });
});

describe('evaluateScheduleReadiness', () => {
  it('is ready with a connected account for the post channel', () => {
    expect(evaluateScheduleReadiness(base())).toEqual({ ready: true, blockers: [] });
  });

  it('requires at least one connected account', () => {
    const r = evaluateScheduleReadiness(base({ targets: [] }));
    expect(r.ready).toBe(false);
    expect(r.blockers).toEqual([{ code: 'NO_CONNECTED_ACCOUNT' }]);
  });

  it('flags every account that is not connected', () => {
    const r = evaluateScheduleReadiness(
      base({
        targets: [
          { socialPageId: 'p1', network: 'INSTAGRAM', status: 'CONNECTED' },
          { socialPageId: 'p2', network: 'FACEBOOK', status: 'NEEDS_REAUTH' },
        ],
      }),
    );
    expect(r.blockers).toEqual([
      {
        code: 'ACCOUNT_NOT_CONNECTED',
        social_page_id: 'p2',
        network: 'facebook',
        account_status: 'NEEDS_REAUTH',
      },
    ]);
  });

  it('requires an account on the post channel for feed networks only', () => {
    const facebookOnly = [{ socialPageId: 'p1', network: 'FACEBOOK', status: 'CONNECTED' }];
    expect(evaluateScheduleReadiness(base({ targets: facebookOnly })).blockers).toEqual([
      { code: 'CHANNEL_NOT_CONNECTED', network: 'instagram' },
    ]);
    expect(evaluateScheduleReadiness(base({ channel: 'blog', targets: facebookOnly })).ready).toBe(
      true,
    );
  });

  it('reports approval and lifecycle blockers from the workflow', () => {
    expect(
      evaluateScheduleReadiness(base({ policy: 'REQUIRED' })).blockers.map((b) => b.code),
    ).toEqual(['APPROVAL_REQUIRED']);
    expect(
      evaluateScheduleReadiness(
        base({ workflow: { status: 'DRAFT', scheduledAt: null, approvalState: 'REJECTED' } }),
      ).blockers.map((b) => b.code),
    ).toEqual(['REJECTED']);
    expect(
      evaluateScheduleReadiness(
        base({ workflow: { status: 'DRAFT', scheduledAt: null, archivedAt: '2026-01-01' } }),
      ).blockers.map((b) => b.code),
    ).toEqual(['ARCHIVED']);
  });

  it('separates pre-schedule and post-schedule blockers', () => {
    const r = evaluateScheduleReadiness(
      base({ targets: [{ socialPageId: 'p1', network: 'FACEBOOK', status: 'CONNECTED' }] }),
    );
    expect(r.blockers.map((b) => b.code)).toEqual(['CHANNEL_NOT_CONNECTED']);
    expect(postScheduleBlockers(r)).toEqual([]);
    expect(accountBlockers(r)).toEqual([]);
    expect(
      calendarPlacement({
        status: 'SCHEDULED',
        scheduleState: 'SCHEDULED',
        plannedAt: null,
        scheduledAt: '2026-12-01T09:00:00.000Z',
        readiness: r,
      }).state,
    ).toBe('SCHEDULED');
  });

  it('skips account checks when the flag is off, keeping approval checks', () => {
    const r = evaluateScheduleReadiness(
      base({ targets: [], requireConnectedAccount: false, policy: 'REQUIRED' }),
    );
    expect(r.blockers.map((b) => b.code)).toEqual(['APPROVAL_REQUIRED']);
    expect(accountBlockers(r)).toEqual([]);
  });

  it('reads the flag, defaulting to on', () => {
    expect(scheduleRequiresConnectedAccount({})).toBe(true);
    expect(scheduleRequiresConnectedAccount({ SCHEDULE_REQUIRES_CONNECTED_ACCOUNT: 'false' })).toBe(
      false,
    );
  });
});

describe('calendarPlacement (Planned vs Scheduled)', () => {
  const at = '2026-12-01T09:00:00.000Z';
  it('separates planned, scheduled, blocked and published', () => {
    expect(
      calendarPlacement({
        status: 'DRAFT',
        scheduleState: 'UNSCHEDULED',
        plannedAt: at,
        scheduledAt: null,
      }),
    ).toEqual({ state: 'PLANNED', at });
    expect(
      calendarPlacement({
        status: 'SCHEDULED',
        scheduleState: 'SCHEDULED',
        plannedAt: '2026-11-30T09:00:00.000Z',
        scheduledAt: at,
      }),
    ).toEqual({ state: 'SCHEDULED', at });
    expect(
      calendarPlacement({
        status: 'SCHEDULED',
        scheduleState: 'SCHEDULED',
        plannedAt: null,
        scheduledAt: at,
        readiness: { ready: false, blockers: [{ code: 'NO_CONNECTED_ACCOUNT' }] },
      }),
    ).toEqual({ state: 'CANNOT_SCHEDULE', at });
    expect(
      calendarPlacement({
        status: 'PUBLISHED_SAMPLE',
        scheduleState: 'UNSCHEDULED',
        plannedAt: null,
        scheduledAt: null,
        publishedAt: at,
      }),
    ).toEqual({ state: 'PUBLISHED', at });
    expect(
      calendarPlacement({
        status: 'DRAFT',
        scheduleState: 'UNSCHEDULED',
        plannedAt: null,
        scheduledAt: null,
      }),
    ).toEqual({ state: 'UNPLANNED', at: null });
  });

  it('never treats an archived post as scheduled', () => {
    expect(
      calendarPlacement({
        status: 'SCHEDULED',
        scheduleState: 'SCHEDULED',
        plannedAt: at,
        scheduledAt: at,
        archivedAt: at,
      }).state,
    ).toBe('PLANNED');
  });
});
