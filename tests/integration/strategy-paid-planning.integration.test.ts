import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  getStrategyVersion,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy paid planning-only', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let brandId: string;
  let strategyId: string;
  let versionId: string;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    const { body: brand } = await createBrand(seed);
    brandId = brand.data.id as string;
    const { body: created } = await createStrategy(seed, brandId);
    strategyId = created.data.id as string;
    versionId = created.data.latest_version.id as string;
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('rejects ad_account_id and provider ids with 400', async () => {
    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    const rowVersion = version.body.data.paid.row_version as number;
    for (const forbidden of [
      'ad_account_id',
      'pixel_id',
      'provider_campaign_id',
      'meta_campaign_id',
    ]) {
      const res = await fetch(
        `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/paid`,
        {
          method: 'PATCH',
          headers: authHeaders(seed),
          body: JSON.stringify({
            row_version: rowVersion,
            budget_amount: '1000',
            [forbidden]: 'act_123',
          }),
        },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(body)).toMatch(/PAID_PLANNING_ONLY/);
    }
  });

  it('paid track read includes planning_only marker', async () => {
    const { body } = await getStrategyVersion(seed, brandId, strategyId, versionId);
    expect(body.data.paid.planning_only).toBe(true);
  });
});
