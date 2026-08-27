import { describe, expect, it } from 'vitest';
import { BRAND_CAPABILITIES, hasCapability, SYSTEM_PROFILES } from './capabilities';

describe('brand capabilities', () => {
  it('defines all brand capability codes', () => {
    expect(BRAND_CAPABILITIES).toEqual([
      'brand.create',
      'brand.read',
      'brand.archive',
      'brand.website.connect',
      'brand.scan.control',
      'brand.discovery.review',
      'brand.insight.edit',
      'brand.insight.decide',
      'brand.version.approve',
    ]);
  });

  it('grants all brand capabilities to COMPANY_OWNER', () => {
    const caps = SYSTEM_PROFILES.COMPANY_OWNER ?? [];
    for (const code of BRAND_CAPABILITIES) {
      expect(hasCapability(caps, code)).toBe(true);
    }
  });

  it('denies brand capabilities to MEMBER by default', () => {
    const caps = SYSTEM_PROFILES.MEMBER ?? [];
    for (const code of BRAND_CAPABILITIES) {
      expect(hasCapability(caps, code)).toBe(false);
    }
  });

  it('separates insight.decide from version.approve', () => {
    expect(hasCapability(['brand.insight.decide'], 'brand.version.approve')).toBe(false);
    expect(hasCapability(['brand.version.approve'], 'brand.insight.decide')).toBe(false);
  });
});
