import { describe, expect, it } from 'vitest';
import { canPatchVersionContent, isVersionContentFrozen, mustReviseToEdit } from '@oma/domain';

describe('strategy immutability', () => {
  it('freezes non-draft versions', () => {
    expect(isVersionContentFrozen('DRAFT')).toBe(false);
    expect(isVersionContentFrozen('IN_REVIEW')).toBe(true);
    expect(isVersionContentFrozen('APPROVED')).toBe(true);
  });

  it('allows patch only on DRAFT', () => {
    expect(canPatchVersionContent('DRAFT')).toBe(true);
    expect(canPatchVersionContent('APPROVED')).toBe(false);
  });

  it('requires revise to edit approved content', () => {
    expect(mustReviseToEdit('APPROVED')).toBe(true);
    expect(mustReviseToEdit('DRAFT')).toBe(false);
  });
});
