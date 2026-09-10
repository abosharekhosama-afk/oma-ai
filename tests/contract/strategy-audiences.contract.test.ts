import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy audiences contract', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('audiences endpoint round-trip', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const base = `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${created.data.id}/versions/${created.data.latest_version.id}`;

    const createdRes = await fetch(`${base}/audiences`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ name: 'Ops', info_class: 'USER_AUTHORED' }),
    });
    expect([200, 201]).toContain(createdRes.status);
    const body = await createdRes.json();
    expect(body.data.name || body.data.id).toBeTruthy();
  });
});
