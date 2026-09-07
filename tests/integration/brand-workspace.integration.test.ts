import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('brand workspace integration', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('CRUD and list under tenant', async () => {
    const { body: created } = await createBrand(seed, 'Acme Integration');
    const list = await fetch(`${seed.baseUrl}/api/v1/brands`, {
      headers: { cookie: authHeaders(seed).cookie },
    });
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.data.some((b: { id: string }) => b.id === created.data.id)).toBe(true);

    const patch = await fetch(`${seed.baseUrl}/api/v1/brands/${created.data.id}`, {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({ name: 'Acme Updated', version: created.data.version }),
    });
    expect(patch.status).toBe(200);
  });
});
