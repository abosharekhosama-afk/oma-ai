import { describe, expect, it } from 'vitest';
import { discoveryTierForField, isRequiredForApproval } from './discovery-tiers';

describe('discovery-tiers', () => {
  it('maps required fields', () => {
    expect(discoveryTierForField('brand.name')).toBe('REQUIRED_FOR_APPROVAL');
    expect(isRequiredForApproval('brand.name')).toBe(true);
  });

  it('defaults unknown to discover when available', () => {
    expect(discoveryTierForField('brand.unknown')).toBe('DISCOVER_WHEN_AVAILABLE');
  });
});
