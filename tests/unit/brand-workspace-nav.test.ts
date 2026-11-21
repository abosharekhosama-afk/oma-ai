import { describe, expect, it } from 'vitest';
import { isBrandStrategyDetailRoute } from '../../apps/web/src/lib/brand-workspace-nav';

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
