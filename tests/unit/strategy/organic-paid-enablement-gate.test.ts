import { describe, expect, it } from 'vitest';
import { validateTrackEnablementForSubmit } from '@oma/domain';

describe('organic paid enablement gate', () => {
  it('allows organic-only with paid rationale', () => {
    expect(
      validateTrackEnablementForSubmit({
        organicEnabled: true,
        paidEnabled: false,
        paidDisabledRationale: 'Not this quarter',
      }).ok,
    ).toBe(true);
  });

  it('allows paid-only with organic rationale', () => {
    expect(
      validateTrackEnablementForSubmit({
        organicEnabled: false,
        paidEnabled: true,
        organicDisabledRationale: 'Organic deferred',
      }).ok,
    ).toBe(true);
  });
});
