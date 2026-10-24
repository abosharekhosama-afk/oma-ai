import { describe, expect, it } from 'vitest';
import { hasCapability, SYSTEM_PROFILES } from '../authz/capabilities';
import { briefFieldsFromDescription, briefReadiness } from './brief-readiness';
import {
  reviewStatusAfterVersionCreate,
  reviewStep,
  versionCreateAllowed,
} from './deliverable-review-policy';

describe('deliverable review policy', () => {
  it('submits a draft into awaiting review', () => {
    expect(reviewStep('DRAFT', 'submit')).toEqual({
      next: 'AWAITING_REVIEW',
      status: 'IN_REVIEW',
    });
    expect(reviewStep('NOT_STARTED', 'submit')).toEqual({
      next: 'AWAITING_REVIEW',
      status: 'IN_REVIEW',
    });
  });

  it('rejects a second approve and any action from approved', () => {
    expect(reviewStep('APPROVED', 'approve')).toBe('ILLEGAL');
    expect(reviewStep('APPROVED', 'request_changes')).toBe('ILLEGAL');
    expect(reviewStep('REJECTED', 'submit')).toBe('ILLEGAL');
  });

  it('allows a version only before approval and keeps changes-requested', () => {
    expect(versionCreateAllowed('DRAFT')).toBe(true);
    expect(versionCreateAllowed('CHANGES_REQUESTED')).toBe(true);
    expect(versionCreateAllowed('AWAITING_REVIEW')).toBe(false);
    expect(versionCreateAllowed('IN_REVIEW')).toBe(false);
    expect(versionCreateAllowed('APPROVED')).toBe(false);
    expect(versionCreateAllowed('REJECTED')).toBe(false);
    expect(reviewStatusAfterVersionCreate('CHANGES_REQUESTED')).toBe('CHANGES_REQUESTED');
    expect(reviewStatusAfterVersionCreate('DRAFT')).toBe('DRAFT');
  });
});

describe('deliverable capability split', () => {
  it('lets approvers decide and writers create versions', () => {
    expect(hasCapability(SYSTEM_PROFILES.APPROVER ?? [], 'deliverable.review.decide')).toBe(true);
    expect(hasCapability(SYSTEM_PROFILES.WRITER ?? [], 'deliverable.review.decide')).toBe(false);
    expect(hasCapability(SYSTEM_PROFILES.WRITER ?? [], 'deliverable.version.create')).toBe(true);
    expect(hasCapability(SYSTEM_PROFILES.APPROVER ?? [], 'deliverable.version.create')).toBe(false);
    expect(hasCapability(SYSTEM_PROFILES.MEMBER ?? [], 'deliverable.review.decide')).toBe(false);
    expect(hasCapability(SYSTEM_PROFILES.COMPANY_OWNER ?? [], 'deliverable.review.decide')).toBe(
      true,
    );
  });
});

describe('brief readiness', () => {
  it('is ready only when objective, audience, and key message are set', () => {
    expect(briefReadiness({ objective: 'a', audience: 'b', keyMessage: 'c' }).ready).toBe(true);
    expect(briefReadiness({ objective: 'a', audience: '', keyMessage: 'c' }).missing).toEqual([
      'audience',
    ]);
  });

  it('reads the legacy description marker', () => {
    const description =
      'plain\n\n__OMA_BRIEF_V1__' +
      JSON.stringify({
        objective: { en: 'Grow' },
        audience: { en: 'Buyers' },
        keyMessage: { en: 'Book now' },
      });
    expect(briefFieldsFromDescription(description)).toEqual({
      objective: 'Grow',
      audience: 'Buyers',
      keyMessage: 'Book now',
    });
  });
});
