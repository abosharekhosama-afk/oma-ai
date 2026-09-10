import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  bringToApproved,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
  setCurrentStrategy,
} from '../helpers/strategy-test';

describe('strategy current concurrency', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('two concurrent set_current with same brand_version: one wins, one CONFLICT_VERSION', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const a = await seedReviewReadyStrategy(seed, brandId);
    const b = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, a.strategyId, a.versionId, a.rowVersion);
    await bringToApproved(seed, brandId, b.strategyId, b.versionId, b.rowVersion);

    const brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    const version = brandRow.version;

    const [r1, r2] = await Promise.all([
      setCurrentStrategy(seed, brandId, a.strategyId, version),
      setCurrentStrategy(seed, brandId, b.strategyId, version),
    ]);

    const statuses = [r1.res.status, r2.res.status].sort();
    expect(statuses).toContain(409);
    expect(statuses.some((s) => s === 200 || s === 201)).toBe(true);

    const conflict = [r1, r2].find((r) => r.res.status === 409);
    expect(conflict?.body.error?.code).toBe('CONFLICT_VERSION');

    const after = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect([a.strategyId, b.strategyId]).toContain(after.currentApprovedStrategyId);
  });
});
