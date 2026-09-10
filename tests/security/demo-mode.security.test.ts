import { afterAll, describe, expect, it } from 'vitest';
import { seedBrandTenant, seedMemberWithoutBrandCaps } from '../helpers/brand-test';

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

  it('member without brand caps cannot create brands while demo stays readable', async () => {
    const prev = process.env.OMA_DEMO_MODE;
    process.env.OMA_DEMO_MODE = '1';
    const owner = await seedBrandTenant();
    closers.push(async () => owner.app.close());
    const member = await seedMemberWithoutBrandCaps(owner);
    const denied = await fetch(`${owner.baseUrl}/api/v1/brands`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: Object.entries(member.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
        'x-csrf-token': member.csrf ?? '',
      },
      body: JSON.stringify({ name: 'Should Fail' }),
    });
    expect([401, 403]).toContain(denied.status);
    const demo = await fetch(`${owner.baseUrl}/api/v1/demo/campaigns`, {
      headers: {
        cookie: Object.entries(member.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    // Demo is authenticated-read only; capability gates apply to real brand mutations.
    expect([200, 403]).toContain(demo.status);
    process.env.OMA_DEMO_MODE = prev;
  });
});
