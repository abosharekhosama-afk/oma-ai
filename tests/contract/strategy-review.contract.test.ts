import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy review', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('covers review uniquely', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const submitted = await submitStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    expect(submitted.body.data.status).toBe('IN_REVIEW');
    const decisions = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${ready.strategyId}/versions/${ready.versionId}/decisions`,
      { headers: { cookie: authHeaders(seed).cookie } },
    );
    expect(decisions.status).toBe(200);
  });
});
