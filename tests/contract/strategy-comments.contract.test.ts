import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy comments', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('covers comments uniquely', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { body: created } = await createStrategy(seed, brandId);
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${created.data.id}/versions/${created.data.latest_version.id}/comments`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ body: 'Review note' }),
      },
    );
    expect([200, 201]).toContain(res.status);
  });
});
