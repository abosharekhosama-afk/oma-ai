import { afterAll, describe, expect, it } from 'vitest';
import { createBrand, createStrategy, seedBrandTenant } from '../helpers/strategy-test';

describe('strategy profile-link', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('covers profile-link uniquely', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    expect(created.data.latest_version.missing_source).toBe(true);
  });
});
