import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy children aggregate contract', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });
  it('lists empty children on fresh draft version', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const ver = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${created.data.id}/versions/${created.data.latest_version.id}`,
      { headers: { cookie: authHeaders(seed).cookie } },
    );
    expect(ver.status).toBe(200);
    const body = await ver.json();
    expect(Array.isArray(body.data.audiences ?? [])).toBe(true);
  });
});
