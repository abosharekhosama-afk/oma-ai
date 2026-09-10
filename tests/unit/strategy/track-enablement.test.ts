import { describe, expect, it } from 'vitest';
import { canToggleTracks, validateTrackEnablementForSubmit } from '@oma/domain';

describe('strategy track enablement', () => {
  it('toggles tracks only in DRAFT', () => {
    expect(canToggleTracks('DRAFT')).toBe(true);
    expect(canToggleTracks('IN_REVIEW')).toBe(false);
  });

  it('requires rationale when a track is disabled', () => {
    expect(
      validateTrackEnablementForSubmit({
        organicEnabled: true,
        paidEnabled: false,
        paidDisabledRationale: 'Deferred',
      }).ok,
    ).toBe(true);
    expect(
      validateTrackEnablementForSubmit({
        organicEnabled: true,
        paidEnabled: false,
      }).ok,
    ).toBe(false);
  });

  it('rejects both tracks disabled', () => {
    expect(
      validateTrackEnablementForSubmit({
        organicEnabled: false,
        paidEnabled: false,
        organicDisabledRationale: 'a',
        paidDisabledRationale: 'b',
      }).ok,
    ).toBe(false);
  });
});
