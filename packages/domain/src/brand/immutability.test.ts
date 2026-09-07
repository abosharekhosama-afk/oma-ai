import { describe, expect, it } from 'vitest';
import { canMutateApprovedContent, isApprovedImmutable } from './immutability';

describe('immutability', () => {
  it('treats approved as immutable', () => {
    expect(isApprovedImmutable('APPROVED')).toBe(true);
    expect(canMutateApprovedContent('DRAFT')).toBe(true);
    expect(canMutateApprovedContent('APPROVED')).toBe(false);
  });
});
