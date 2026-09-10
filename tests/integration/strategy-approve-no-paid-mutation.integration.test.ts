import { afterAll, describe, expect, it } from 'vitest';
import {
  approveStrategy,
  createBrand,
  getStrategyVersion,
  seedBothTracksReadyStrategy,
  seedBrandTenant,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy approve no paid mutation', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('approve does not invent ad provider ids on paid plan', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const ready = await seedBothTracksReadyStrategy(seed, brand.data.id);
    const submitted = await submitStrategy(
      seed,
      brand.data.id,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    const approved = await approveStrategy(
      seed,
      brand.data.id,
      ready.strategyId,
      ready.versionId,
      submitted.body.data.row_version,
    );
    expect([200, 201]).toContain(approved.res.status);
    const ver = await getStrategyVersion(seed, brand.data.id, ready.strategyId, ready.versionId);
    expect(ver.body.data.paid?.planning_only ?? true).toBe(true);
    expect(JSON.stringify(ver.body.data.paid ?? {})).not.toMatch(
      /ad_account|campaign_id|provider_account/i,
    );
  });
});
