import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  bringToApproved,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
  setCurrentStrategy,
} from '../helpers/strategy-test';

describe('strategy current clear', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('clear current sets currentApprovedStrategyId null', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);

    let brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    const set = await setCurrentStrategy(seed, brandId, ready.strategyId, brandRow.version);
    expect([200, 201]).toContain(set.res.status);

    brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brandRow.currentApprovedStrategyId).toBe(ready.strategyId);

    const clear = await setCurrentStrategy(seed, brandId, null, brandRow.version);
    expect([200, 201]).toContain(clear.res.status);
    expect(clear.body.data.strategy).toBeNull();

    brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brandRow.currentApprovedStrategyId).toBeNull();
  });
});
