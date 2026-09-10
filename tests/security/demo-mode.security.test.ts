import { afterAll, describe, expect, it } from 'vitest';
import { seedBrandTenant } from '../helpers/brand-test';

describe('demo API security', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('rejects demo graph when OMA_DEMO_MODE is off', async () => {
    const prev = process.env.OMA_DEMO_MODE;
    process.env.OMA_DEMO_MODE = '0';
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const res = await fetch(`${seed.baseUrl}/api/v1/demo/graph`, {
      headers: {
        cookie: Object.entries(seed.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    expect([403, 404]).toContain(res.status);
    process.env.OMA_DEMO_MODE = prev;
  });

  it('serves linked graph when OMA_DEMO_MODE is on', async () => {
    const prev = process.env.OMA_DEMO_MODE;
    process.env.OMA_DEMO_MODE = '1';
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const res = await fetch(`${seed.baseUrl}/api/v1/demo/journey`, {
      headers: {
        cookie: Object.entries(seed.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-oma-demo-data')).toBe('1');
    const body = (await res.json()) as {
      data: { brand: { id: string }; strategy: { brandId: string } };
    };
    expect(body.data.strategy.brandId).toBe(body.data.brand.id);
    process.env.OMA_DEMO_MODE = prev;
  });
});
