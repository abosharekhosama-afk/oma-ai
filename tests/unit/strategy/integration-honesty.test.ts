import { describe, expect, it } from 'vitest';
import { INTEGRATION_HONESTY, adPlatformHonestyMessage } from '@oma/domain';

describe('integration honesty', () => {
  it('exposes deferred ad-platform honesty copy', () => {
    expect(INTEGRATION_HONESTY.AD_PLATFORM_NOT_CONNECTED).toBeTruthy();
    expect(adPlatformHonestyMessage()).toMatch(/planning/i);
  });
});
