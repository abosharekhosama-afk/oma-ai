import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy paid planning-only', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('rejects provider campaign ids on paid patch', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${strategyId}/versions/${versionId}/paid`,
      {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: 1,
          budget_amount: '1000',
          ad_account_id: 'act_123',
        }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_FAILED');
  });
});
