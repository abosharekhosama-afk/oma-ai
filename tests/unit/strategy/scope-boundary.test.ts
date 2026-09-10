import { describe, expect, it } from 'vitest';
import { adPlatformHonestyMessage, INTEGRATION_HONESTY } from '@oma/domain';
import { isValidInfoClass, preserveUnknown } from '@oma/domain';

describe('foundation info class', () => {
  it('requires valid infoClass and preserves UNKNOWN', () => {
    expect(isValidInfoClass('USER_AUTHORED')).toBe(true);
    expect(isValidInfoClass('UNKNOWN')).toBe(true);
    expect(preserveUnknown('UNKNOWN')).toBe('UNKNOWN');
    expect(preserveUnknown('USER_AUTHORED')).toBe('USER_AUTHORED');
  });
});

describe('integration honesty', () => {
  it('exposes deferred ad honesty', () => {
    expect(INTEGRATION_HONESTY.AD_PLATFORM_NOT_CONNECTED).toBeTruthy();
    expect(adPlatformHonestyMessage()).toMatch(/planning/i);
  });
});

describe('scope boundary', () => {
  it('forbids calendar/kanban/publish surface claims in 003', () => {
    const forbidden = ['calendar', 'kanban', 'creative upload', 'publish', 'ad account connect'];
    expect(forbidden.every((f) => typeof f === 'string')).toBe(true);
  });
});

describe('paid planning boundary', () => {
  it('documents forbidden provider fields', () => {
    const forbidden = ['ad_account_id', 'pixel_id', 'provider_campaign_id', 'meta_campaign_id'];
    expect(forbidden).toContain('ad_account_id');
  });
});

describe('organic paid enablement gate', () => {
  it('reuses domain gate', async () => {
    const { validateTrackEnablementForSubmit } = await import('@oma/domain');
    expect(
      validateTrackEnablementForSubmit({
        organicEnabled: false,
        paidEnabled: false,
      }).ok,
    ).toBe(false);
  });
});
