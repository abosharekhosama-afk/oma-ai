import { describe, expect, it } from 'vitest';
import {
  brandPathTailLabel,
  brandWorkspaceNavMode,
  isBrandRecordId,
  isBrandStrategyDetailRoute,
} from '../../apps/web/src/lib/brand-workspace-nav';

describe('isBrandStrategyDetailRoute', () => {
  const brandId = 'b1';

  it('returns true on strategy version routes', () => {
    expect(
      isBrandStrategyDetailRoute(`/app/brands/${brandId}/strategies/s1/organic`, brandId),
    ).toBe(true);
  });

  it('returns false on hub list and new', () => {
    expect(isBrandStrategyDetailRoute(`/app/brands/${brandId}/strategies`, brandId)).toBe(false);
    expect(isBrandStrategyDetailRoute(`/app/brands/${brandId}/strategies/new`, brandId)).toBe(
      false,
    );
  });
});

describe('brand workspace navigation', () => {
  const brandId = 'b1';

  it('detects record ids in trails', () => {
    expect(isBrandRecordId('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBe(true);
    expect(isBrandRecordId('organic')).toBe(false);
  });

  it('uses human trail labels instead of ids', () => {
    const label = brandPathTailLabel(
      `/app/brands/${brandId}/profiles/01ARZ3NDEKTSV4RRFFQ69G5FAV`,
      brandId,
      (k) => (k === 'brand.profile.title' ? 'Profile file' : k),
    );
    expect(label).toBe('Profile file');
  });

  it('exposes one nav layer per depth', () => {
    expect(brandWorkspaceNavMode(`/app/brands/${brandId}`, brandId)).toBe('primary-only');
    expect(brandWorkspaceNavMode(`/app/brands/${brandId}/discovery`, brandId)).toBe('none');
    expect(brandWorkspaceNavMode(`/app/brands/${brandId}/strategies/s1/organic`, brandId)).toBe(
      'none',
    );
  });
});
