import { afterAll, describe, expect, it } from 'vitest';
import { createBrand, createStrategy, seedBrandTenant } from '../helpers/strategy-test';

describe('strategy paid no ad egress security', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('rejects paid patch with ad_account_id and never returns provider connection fields', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id, { paid_enabled: true });
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    const row = created.data.latest_version.row_version as number;
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${strategyId}/versions/${versionId}/paid`,
      {
        method: 'PATCH',
        headers: {
          cookie: Object.entries(seed.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; '),
          'content-type': 'application/json',
          'x-csrf-token': seed.cookies.oma_csrf,
        },
        body: JSON.stringify({ row_version: row, ad_account_id: 'act_123', budget_amount: '100' }),
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/access_token|client_secret|oauth/i);
  });
});
