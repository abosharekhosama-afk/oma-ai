import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  getStrategyVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

describe('strategy organic', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('patches organic track using track row_version', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const ver = await getStrategyVersion(seed, brandId, ready.strategyId, ready.versionId);
    const trackRow = ver.body.data.organic?.row_version as number;
    expect(typeof trackRow).toBe('number');
    const organic = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${ready.strategyId}/versions/${ready.versionId}/organic`,
      {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: trackRow,
          channels: [{ value: 'LinkedIn', infoClass: 'USER_AUTHORED' }],
          frequency: '3x/week',
        }),
      },
    );
    expect([200, 201]).toContain(organic.status);
    const body = await organic.json();
    expect(body.data.organic?.frequency ?? body.data.frequency).toBeTruthy();
  });
});
