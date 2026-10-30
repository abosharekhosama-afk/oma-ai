import { describe, expect, it } from 'vitest';
import { assertCanPublish, assertCanSchedule, canSchedule, resolveContentWorkflow } from './workflow';
import { applyContentApprovalTransition, nextApproverCount } from './approval-transitions';
import { applyCampaignTransition, canTransitionCampaign } from './campaign-transitions';
import { DomainError } from '../errors';

describe('resolveContentWorkflow', () => {
  it('blocks schedule when policy REQUIRED and not approved', () => {
    const wf = resolveContentWorkflow(
      { status: 'IN_REVIEW', scheduledAt: null, approvalState: 'PENDING' },
      'REQUIRED',
    );
    expect(wf.scheduleBlocked).toBe(true);
    expect(wf.publishDisplay).toBe('APPROVAL_PENDING');
    expect(wf.publishingConnected).toBe(false);
  });

  it('allows schedule when APPROVED under REQUIRED', () => {
    const wf = resolveContentWorkflow(
      {
        status: 'APPROVED',
        scheduledAt: null,
        approvalState: 'APPROVED',
        approverApproved: 1,
        approverRequired: 1,
      },
      'REQUIRED',
    );
    expect(wf.scheduleBlocked).toBe(false);
    expect(
      canSchedule(
        {
          status: 'APPROVED',
          scheduledAt: null,
          approvalState: 'APPROVED',
          approverApproved: 1,
          approverRequired: 1,
        },
        'REQUIRED',
      ),
    ).toBe(true);
  });

  it('assertCanSchedule throws DomainError SCHEDULE_BLOCKED', () => {
    expect(() =>
      assertCanSchedule(
        { status: 'DRAFT', scheduledAt: null, approvalState: 'NOT_REQUESTED' },
        'REQUIRED',
      ),
    ).toThrow(DomainError);
  });

  it('shows PLANNED_DATE when plannedAt set', () => {
    const wf = resolveContentWorkflow(
      { status: 'DRAFT', scheduledAt: null, plannedAt: '2026-10-19T10:00:00Z' },
      'OPTIONAL',
    );
    expect(wf.publishDisplay).toBe('PLANNED_DATE');
  });
});

describe('content approval transitions', () => {
  it('request_approval moves to PENDING', () => {
    const next = applyContentApprovalTransition({
      command: 'request_approval',
      approvalState: 'NOT_REQUESTED',
      status: 'DRAFT',
      approverApproved: 0,
      approverRequired: 1,
    });
    expect(next.approvalState).toBe('PENDING');
    expect(next.status).toBe('IN_REVIEW');
  });

  it('partial then full approve', () => {
    const mid = applyContentApprovalTransition({
      command: 'approve',
      approvalState: 'PENDING',
      status: 'IN_REVIEW',
      approverApproved: 0,
      approverRequired: 2,
    });
    expect(mid.approvalState).toBe('PARTIALLY_APPROVED');
    const count = nextApproverCount(0, mid.deltaApproved, 2);
    expect(count).toBe(1);
    const done = applyContentApprovalTransition({
      command: 'approve',
      approvalState: 'PARTIALLY_APPROVED',
      status: 'IN_REVIEW',
      approverApproved: 1,
      approverRequired: 2,
    });
    expect(done.approvalState).toBe('APPROVED');
    expect(done.status).toBe('APPROVED');
  });
});

describe('campaign transitions', () => {
  it('archive from ACTIVE', () => {
    expect(canTransitionCampaign('ACTIVE', 'archive')).toBe(true);
    expect(applyCampaignTransition('ACTIVE', 'archive')).toBe('ARCHIVED');
  });

  it('rejects transition from ARCHIVED to ACTIVE', () => {
    expect(canTransitionCampaign('ARCHIVED', 'activate')).toBe(false);
  });
});

describe('Planable approval policies (PR A)', () => {
  const base = {
    status: 'DRAFT',
    scheduledAt: null,
    plannedAt: '2026-11-01T09:00:00.000Z',
    scheduleState: 'UNSCHEDULED' as const,
  };

  it('REQUIRED blocks scheduling until all approvers approved (1 of 2)', () => {
    const partial = { ...base, approvalState: 'PARTIALLY_APPROVED', approverApproved: 1, approverRequired: 2 };
    const wf = resolveContentWorkflow(partial, 'REQUIRED');
    expect(wf.scheduleBlocked).toBe(true);
    expect(wf.scheduleBlockedReason).toBe('APPROVAL_REQUIRED');
    expect(wf.approverApproved).toBe(1);
    expect(wf.approverRequired).toBe(2);
    expect(() => assertCanSchedule(partial, 'REQUIRED')).toThrow(/fully approved/);
    const full = { ...partial, approvalState: 'APPROVED', approverApproved: 2 };
    expect(() => assertCanSchedule(full, 'REQUIRED')).not.toThrow();
  });

  it('OPTIONAL blocks scheduling until approved; NONE still allows unapproved drafts', () => {
    const draft = { ...base, approvalState: 'NOT_REQUESTED', approverApproved: 0, approverRequired: 1 };
    expect(canSchedule(draft, 'OPTIONAL')).toBe(false);
    expect(canSchedule(draft, 'NONE')).toBe(true);
    const approved = { ...draft, approvalState: 'APPROVED', approverApproved: 1 };
    expect(canSchedule(approved, 'OPTIONAL')).toBe(true);
  });

  it('rejected posts cannot be scheduled or published under any policy', () => {
    const rejected = { ...base, approvalState: 'REJECTED', approverApproved: 0, approverRequired: 1 };
    for (const p of ['NONE', 'OPTIONAL', 'REQUIRED'] as const) {
      expect(() => assertCanSchedule(rejected, p)).toThrow(/Rejected/);
      expect(() => assertCanPublish(rejected, p)).toThrow(/Rejected/);
    }
  });

  it('archived posts are never shown as scheduled and cannot be scheduled', () => {
    const archived = {
      ...base,
      status: 'SCHEDULED',
      scheduleState: 'SCHEDULED' as const,
      scheduledAt: '2026-11-02T09:00:00.000Z',
      approvalState: 'APPROVED',
      archivedAt: '2026-10-25T10:00:00.000Z',
    };
    const wf = resolveContentWorkflow(archived, 'OPTIONAL');
    expect(wf.scheduleState).toBe('UNSCHEDULED');
    expect(wf.publishDisplay).not.toBe('SCHEDULED_LOCAL');
    expect(() => assertCanSchedule(archived, 'OPTIONAL')).toThrow(/Archived/);
  });

  it('a planned date alone is not a schedule and external publishing is never connected', () => {
    const wf = resolveContentWorkflow({ ...base, approvalState: 'NOT_REQUESTED' }, 'OPTIONAL');
    expect(wf.scheduleState).toBe('UNSCHEDULED');
    expect(wf.plannedAt).toBe(base.plannedAt);
    expect(wf.publishDisplay).toBe('PLANNED_DATE');
    expect(wf.publishingConnected).toBe(false);
  });
});
