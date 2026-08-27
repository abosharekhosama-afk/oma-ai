import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('brand workspace contract', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /brands requires auth', async () => {
    const res = await fetch(`${seed.baseUrl}/api/v1/brands`);
    expect(res.status).toBe(401);
  });

  it('POST /brands creates draft brand', async () => {
    const { res, body } = await createBrand(seed);
    expect(res.status).toBe(201);
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.version).toBe(1);
  });

  it('GET /brands/:id returns workspace summary', async () => {
    const { body: created } = await createBrand(seed);
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${created.data.id}`, {
      headers: { cookie: authHeaders(seed).cookie },
    });
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.id).toBe(created.data.id);
    expect(body.data.version).toBeTypeOf('number');
  });

  it('PATCH /brands/:id updates name with version', async () => {
    const { body: created } = await createBrand(seed);
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${created.data.id}`, {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({ name: 'Updated Name', version: created.data.version }),
    });
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.name).toBe('Updated Name');
  });

  it('POST /brands/:id/archive archives brand', async () => {
    const { body: created } = await createBrand(seed);
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${created.data.id}/archive`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ version: created.data.version }),
    });
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.status).toBe('ARCHIVED');
  });
});
