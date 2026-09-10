import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  cloneStrategy,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

describe('strategy clone', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('clone creates new strategy draft with origin lineage', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const cloned = await cloneStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      'Cloned Draft',
    );
    expect([200, 201]).toContain(cloned.res.status);
    expect(cloned.body.data.id).not.toBe(ready.strategyId);
    expect(cloned.body.data.origin_strategy_id).toBe(ready.strategyId);
    expect(cloned.body.data.name).toBe('Cloned Draft');
    expect(cloned.body.data.latest_version.status).toBe('DRAFT');
    expect(cloned.body.data.is_current).toBe(false);

    const brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brandRow.currentApprovedStrategyId).toBeNull();
  });
});
