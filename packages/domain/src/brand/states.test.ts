import { describe, expect, it } from 'vitest';
import { canApproveProfile, canEditProfile, canMutateBrand, isTerminalScanStatus } from './states';

describe('brand states', () => {
  it('detects terminal scan statuses', () => {
    expect(isTerminalScanStatus('SUCCEEDED')).toBe(true);
    expect(isTerminalScanStatus('CRAWLING')).toBe(false);
  });

  it('blocks archived brand mutation', () => {
    expect(canMutateBrand('ACTIVE')).toBe(true);
    expect(canMutateBrand('ARCHIVED')).toBe(false);
  });

  it('allows profile edit only in draft/review', () => {
    expect(canEditProfile('DRAFT')).toBe(true);
    expect(canEditProfile('NEEDS_REVIEW')).toBe(true);
    expect(canEditProfile('APPROVED')).toBe(false);
  });

  it('allows approve only from needs review', () => {
    expect(canApproveProfile('NEEDS_REVIEW')).toBe(true);
    expect(canApproveProfile('DRAFT')).toBe(false);
  });
});
