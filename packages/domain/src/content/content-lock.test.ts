import { describe, expect, it } from 'vitest';
import { applyContentApprovalTransition } from './approval-transitions';
import {
  assertContentMutable,
  decideContentMutation,
  isContentLocked,
  parseReopenReason,
} from './content-lock';

const base = { approverApproved: 0, policy: 'REQUIRED' as const, lockAfterApproval: true };

describe('content lock (DEC-025)', () => {
  it('locks publishable fields on approved content when lockAfterApproval is on', () => {
    expect(isContentLocked({ approvalState: 'APPROVED', lockAfterApproval: true })).toBe(true);
    expect(decideContentMutation({ ...base, approvalState: 'APPROVED' }, ['caption'])).toEqual({
      kind: 'locked',
      fields: ['caption'],
    });
    expect(() =>
      assertContentMutable({ ...base, approvalState: 'APPROVED' }, ['publish_targets']),
    ).toThrowError(/locked/);
  });

  it('never locks planning metadata (no locked fields touched)', () => {
    expect(decideContentMutation({ ...base, approvalState: 'APPROVED' }, [])).toEqual({
      kind: 'allow',
    });
  });

  it('resets approval on edit when the lock is off', () => {
    const d = decideContentMutation(
      { ...base, lockAfterApproval: false, approvalState: 'APPROVED' },
      ['title', 'title'],
    );
    expect(d).toMatchObject({
      kind: 'reset',
      from: 'APPROVED',
      fields: ['title'],
      unschedule: true,
      data: { approvalState: 'NOT_REQUESTED', approverApproved: 0 },
    });
    const optional = decideContentMutation(
      { ...base, policy: 'OPTIONAL', lockAfterApproval: false, approvalState: 'APPROVED' },
      ['media'],
    );
    expect(optional).toMatchObject({ kind: 'reset', unschedule: false });
    expect(
      decideContentMutation(
        { ...base, policy: 'NONE', lockAfterApproval: false, approvalState: 'APPROVED' },
        ['media'],
      ),
    ).toEqual({ kind: 'allow' });
  });

  it('restarts collected approvals when a partially approved post changes', () => {
    expect(
      decideContentMutation({ ...base, approvalState: 'PARTIALLY_APPROVED', approverApproved: 1 }, [
        'caption',
      ]),
    ).toMatchObject({ kind: 'reset', data: { approvalState: 'PENDING', approverApproved: 0 } });
    expect(decideContentMutation({ ...base, approvalState: 'PENDING' }, ['caption'])).toEqual({
      kind: 'allow',
    });
    expect(decideContentMutation({ ...base, approvalState: 'DRAFT' }, ['caption'])).toEqual({
      kind: 'allow',
    });
  });

  it('reopen and request-changes are the explicit unlock transitions', () => {
    const t = { status: 'APPROVED' as const, approverApproved: 2, approverRequired: 2 };
    expect(
      applyContentApprovalTransition({ ...t, command: 'reopen', approvalState: 'APPROVED' }),
    ).toMatchObject({ approvalState: 'NOT_REQUESTED', status: 'DRAFT' });
    expect(
      applyContentApprovalTransition({
        ...t,
        command: 'request_changes',
        approvalState: 'APPROVED',
      }),
    ).toMatchObject({ approvalState: 'CHANGES_REQUESTED', status: 'DRAFT' });
    expect(() =>
      applyContentApprovalTransition({ ...t, command: 'reopen', approvalState: 'PENDING' }),
    ).toThrow();
  });

  it('requires a reopen reason', () => {
    expect(parseReopenReason('  typo in caption ')).toBe('typo in caption');
    expect(parseReopenReason({ en: 'fix' })).toBe('fix');
    expect(() => parseReopenReason('   ')).toThrow();
    expect(() => parseReopenReason(undefined)).toThrow();
    expect(() => parseReopenReason('x'.repeat(1001))).toThrow();
  });
});
