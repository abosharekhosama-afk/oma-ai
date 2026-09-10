import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bringToApproved,
  compareStrategyVersions,
  createBrand,
  reviseStrategy,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

describe('strategy compare', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('GET compare between two versions returns diff fields', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);
    const revised = await reviseStrategy(seed, brandId, ready.strategyId, ready.versionId);
    expect([200, 201]).toContain(revised.res.status);
    const rightId = revised.body.data.id as string;

    const { res, body } = await compareStrategyVersions(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      rightId,
    );
    expect(res.status).toBe(200);
    expect(body.data.left.id).toBe(ready.versionId);
    expect(body.data.right.id).toBe(rightId);
    expect(body.data.diff_summary).toEqual(
      expect.objectContaining({
        status_changed: expect.any(Boolean),
        foundation_changed: expect.any(Boolean),
        organic_enablement_changed: expect.any(Boolean),
        paid_enablement_changed: expect.any(Boolean),
      }),
    );
    expect(body.data.diff_summary.status_changed).toBe(true);
  });
});
