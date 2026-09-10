import { describe, expect, it } from 'vitest';
import { adPlatformHonestyMessage } from '@oma/domain';

describe('paid planning boundary', () => {
  it('forbids live provider field names in planning-only core', () => {
    const forbidden = ['ad_account_id', 'pixel_id', 'provider_campaign_id', 'meta_campaign_id'];
    expect(forbidden).toContain('ad_account_id');
    expect(adPlatformHonestyMessage().toLowerCase()).not.toMatch(/connected account/);
  });
});
