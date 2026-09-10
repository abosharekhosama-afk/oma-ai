import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy paid contract', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('paid endpoint round-trip', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const base = `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${created.data.id}/versions/${created.data.latest_version.id}`;

    const row = created.data.latest_version.row_version;
    const paid = await fetch(`${base}/paid`, {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({ row_version: row, budget_amount: '100', budget_currency: 'USD' }),
    });
    expect([200, 201]).toContain(paid.status);
    const body = await paid.json();
    expect(JSON.stringify(body)).toMatch(/planning|budget|100/i);
  });
});
