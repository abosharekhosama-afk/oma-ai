import { afterAll, describe, expect, it } from 'vitest';
import {
  createBrand,
  createStrategy,
  seedApprovedProfileVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
  setCurrentStrategy,
  submitStrategy,
  approveStrategy,
} from '../helpers/strategy-test';
import { getPrisma } from '@oma/db';

describe('strategy current pointer', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('never auto-sets current on approve; set/clear with brand version', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const a = await seedReviewReadyStrategy(seed, brandId);
    const submitted = await submitStrategy(seed, brandId, a.strategyId, a.versionId, a.rowVersion);
    await approveStrategy(
      seed,
      brandId,
      a.strategyId,
      a.versionId,
      submitted.body.data.row_version,
    );
    let brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brand.currentApprovedStrategyId).toBeNull();

    const set = await setCurrentStrategy(seed, brandId, a.strategyId, brand.version);
    expect([200, 201]).toContain(set.res.status);

    brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    const stale = await setCurrentStrategy(seed, brandId, null, brand.version - 1);
    expect(stale.res.status).toBe(409);

    const clear = await setCurrentStrategy(seed, brandId, null, brand.version);
    expect([200, 201]).toContain(clear.res.status);
    brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brand.currentApprovedStrategyId).toBeNull();
  });

  it('rejects set-current for strategy without approved version', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    await seedApprovedProfileVersion(seed.tenantId, brandId);
    const { body: created } = await createStrategy(seed, brandId);
    const brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    const res = await setCurrentStrategy(seed, brandId, created.data.id, brand.version);
    expect(res.res.status).toBe(422);
  });
});
