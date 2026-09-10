import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  bringToApproved,
  createBrand,
  getStrategy,
  seedBrandTenant,
  seedReviewReadyStrategy,
  setCurrentStrategy,
} from '../helpers/strategy-test';

describe('strategy current pointer', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('two approved strategies; set B current; A stays APPROVED; current is B', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const a = await seedReviewReadyStrategy(seed, brandId);
    const b = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, a.strategyId, a.versionId, a.rowVersion);
    await bringToApproved(seed, brandId, b.strategyId, b.versionId, b.rowVersion);

    const brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    const set = await setCurrentStrategy(seed, brandId, b.strategyId, brandRow.version);
    expect([200, 201]).toContain(set.res.status);
    expect(set.body.data.strategy.id).toBe(b.strategyId);

    const after = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(after.currentApprovedStrategyId).toBe(b.strategyId);

    const versionA = await getPrisma().strategyVersion.findUniqueOrThrow({
      where: { id: a.versionId },
    });
    expect(versionA.status).toBe('APPROVED');

    const stratA = await getStrategy(seed, brandId, a.strategyId);
    expect(stratA.body.data.is_current).toBe(false);
    const stratB = await getStrategy(seed, brandId, b.strategyId);
    expect(stratB.body.data.is_current).toBe(true);
  });
});
