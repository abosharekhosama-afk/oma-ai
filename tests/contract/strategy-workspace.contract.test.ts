import { afterAll, describe, expect, it } from 'vitest';
import { createBrand, createStrategy, seedBrandTenant } from '../helpers/strategy-test';

describe('strategy workspace contract', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });
  it('lists strategies for brand', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    await createStrategy(seed, brand.data.id, { name: 'Listed' });
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies`, {
      headers: {
        cookie: Object.entries(seed.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.length ?? body.data?.items?.length ?? 0).toBeGreaterThan(0);
  });
});
