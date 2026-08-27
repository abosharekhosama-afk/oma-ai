import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('brand tenant isolation security', () => {
  let app: INestApplication;
  let t1: Awaited<ReturnType<typeof seedBrandTenant>>;
  let t2: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    t1 = await seedBrandTenant();
    t2 = await seedBrandTenant();
    app = t1.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('denies cross-tenant brand read', async () => {
    const { body: brand } = await createBrand(t1);
    const probe = await fetch(`${t1.baseUrl}/api/v1/brands/${brand.data.id}`, {
      headers: { cookie: `oma_session=${t2.cookies.oma_session}` },
    });
    expect(probe.status).toBe(404);
  });
});
