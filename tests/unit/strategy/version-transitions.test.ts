import { describe, expect, it } from 'vitest';
import { canTransitionVersion, nextVersionStatus, reviseSourceAllowed } from '@oma/domain';

describe('strategy version transitions', () => {
  it('allows create into DRAFT', () => {
    expect(canTransitionVersion(null, 'create')).toBe(true);
    expect(nextVersionStatus(null, 'create')).toBe('DRAFT');
  });

  it('moves draft through review decisions', () => {
    expect(nextVersionStatus('DRAFT', 'submit')).toBe('IN_REVIEW');
    expect(nextVersionStatus('IN_REVIEW', 'approve')).toBe('APPROVED');
    expect(nextVersionStatus('IN_REVIEW', 'reject')).toBe('REJECTED');
    expect(nextVersionStatus('IN_REVIEW', 'request_changes')).toBe('CHANGES_REQUESTED');
  });

  it('allows revise only from terminal review outcomes', () => {
    expect(reviseSourceAllowed('APPROVED')).toBe(true);
    expect(reviseSourceAllowed('REJECTED')).toBe(true);
    expect(reviseSourceAllowed('CHANGES_REQUESTED')).toBe(true);
    expect(reviseSourceAllowed('DRAFT')).toBe(false);
    expect(nextVersionStatus('APPROVED', 'revise')).toBe('DRAFT');
  });
});
