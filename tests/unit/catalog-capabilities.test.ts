import { describe, expect, it } from 'vitest';
import { matchRequirements } from '../../apps/api/src/common/guards/capabilities.guard';

describe('catalog API capability routes', () => {
  it('maps catalog generate and media endpoints', () => {
    expect(
      matchRequirements('POST', '/api/v1/brands/br_1/catalog/products/prod_9/generate'),
    ).toEqual(['brand.read']);
    expect(matchRequirements('GET', '/api/v1/brands/br_1/catalog/products/prod_9/media')).toEqual([
      'brand.read',
    ]);
    expect(matchRequirements('POST', '/api/v1/brands/br_1/catalog/media/link_1/review')).toEqual([
      'brand.read',
    ]);
  });
});
