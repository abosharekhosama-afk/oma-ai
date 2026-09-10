import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  approveStrategy,
  createBrand,
  getStrategyVersion,
  reviseStrategy,
  seedBrandTenant,
  seedReviewReadyStrategy,
  setTrackEnablement,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy supersede', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('second package approve marks prior approved version SUPERSEDED', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const s1 = await submitStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    await approveStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      s1.body.data.row_version,
    );

    const revised = await reviseStrategy(seed, brandId, ready.strategyId, ready.versionId);
    const draftId = revised.body.data.id as string;
    let row = revised.body.data.row_version as number;
    const enabled = await setTrackEnablement(seed, brandId, ready.strategyId, draftId, row, {
      organic_enabled: true,
      paid_enabled: false,
      paid_disabled_rationale: 'Still deferred',
    });
    row = enabled.body.data.row_version;
    const s2 = await submitStrategy(seed, brandId, ready.strategyId, draftId, row);
    await approveStrategy(seed, brandId, ready.strategyId, draftId, s2.body.data.row_version);

    const prior = await getPrisma().strategyVersion.findUniqueOrThrow({
      where: { id: ready.versionId },
    });
    expect(prior.status).toBe('SUPERSEDED');
    const current = await getStrategyVersion(seed, brandId, ready.strategyId, draftId);
    expect(current.body.data.status).toBe('APPROVED');
  });
});
