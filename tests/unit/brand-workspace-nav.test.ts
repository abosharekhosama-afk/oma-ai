import { describe, expect, it } from 'vitest';
import { brandNavSection } from '../../apps/web/src/lib/brand-workspace-nav';

describe('brandNavSection', () => {
  const brandId = '01BRAND';

  it('classifies merged evidence routes', () => {
    expect(brandNavSection(`/app/brands/${brandId}/connect`, brandId)).toBe('evidence');
    expect(brandNavSection(`/app/brands/${brandId}/scans/x`, brandId)).toBe('evidence');
    expect(brandNavSection(`/app/brands/${brandId}/evidence`, brandId)).toBe('evidence');
  });

  it('classifies strategy hub routes', () => {
    expect(brandNavSection(`/app/brands/${brandId}/intelligence`, brandId)).toBe('strategy');
    expect(brandNavSection(`/app/brands/${brandId}/profiles`, brandId)).toBe('strategy');
    expect(brandNavSection(`/app/brands/${brandId}/strategies/x`, brandId)).toBe('strategy');
  });

  it('uses overview for brand home', () => {
    expect(brandNavSection(`/app/brands/${brandId}`, brandId)).toBe('overview');
  });
});
