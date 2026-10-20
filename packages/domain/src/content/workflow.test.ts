import { describe, expect, it } from 'vitest';
import { assertCanSchedule, canSchedule, resolveContentWorkflow } from './workflow';
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
    expect(canSchedule(
      { status: 'APPROVED', scheduledAt: null, approvalState: 'APPROVED', approverApproved: 1, approverRequired: 1 },
      'REQUIRED',
    )).toBe(true);
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
