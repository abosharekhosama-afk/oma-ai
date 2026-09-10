import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy paid integration', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('persists planning budget without provider ids', async () => {
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
        headers: authHeaders(seed),
        body: JSON.stringify({ row_version: row, budget_amount: '250', budget_currency: 'USD' }),
      },
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(String(body.data.paid?.budget_amount ?? body.data.budget_amount ?? '')).toMatch(/250/);
  });
});
