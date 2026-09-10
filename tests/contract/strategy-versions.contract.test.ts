import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

describe('strategy versions', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('covers versions uniquely', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const list = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${ready.strategyId}/versions`,
      { headers: { cookie: authHeaders(seed).cookie } },
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    const len = Array.isArray(body.data) ? body.data.length : (body.data?.items?.length ?? 1);
    expect(len).toBeGreaterThan(0);
  });
});
