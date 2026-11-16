import { describe, expect, it } from 'vitest';
import { referenceTaxonomyFromInfoState } from './reference-taxonomy';

describe('referenceTaxonomyFromInfoState', () => {
  it.each([
    ['OBSERVED', 'Fact'],
    ['USER_CONFIRMED', 'Fact'],
    ['AI_INFERRED', 'Inference'],
    ['USER_CORRECTED', 'Proposal'],
  ])('maps %s to %s', (state, expected) => {
    expect(referenceTaxonomyFromInfoState(state)).toBe(expected);
  });

  it('does not misclassify stale or unknown provenance', () => {
    expect(referenceTaxonomyFromInfoState('STALE')).toBeNull();
    expect(referenceTaxonomyFromInfoState('UNKNOWN')).toBeNull();
  });
});
