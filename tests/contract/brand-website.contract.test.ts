import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  authHeaders,
  connectWebsite,
  createBrand,
  FIXTURE_WEBSITE_URL,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('brand website contract', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('POST website requires attestation', async () => {
    const { body: brand } = await createBrand(seed);
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brand.data.id}/website`, {
      method: 'POST',
      headers: authHeaders(seed, { 'idempotency-key': 'attest-test' }),
      body: JSON.stringify({
        url: FIXTURE_WEBSITE_URL,
        authorization_attested: false,
        version: brand.data.version,
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST website connects fixture URL', async () => {
    const { body: brand } = await createBrand(seed);
    const { res, body } = await connectWebsite(
      seed,
      brand.data.id,
      FIXTURE_WEBSITE_URL,
      brand.data.version,
    );
    expect([200, 201]).toContain(res.status);
    expect(body.data.validation_status).toBe('VALID');
    expect(body.data.brand_status).toBe('READY_TO_SCAN');
  });

  it('GET website returns source metadata', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brand.data.id}/website`, {
      headers: { cookie: authHeaders(seed).cookie },
    });
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.normalized_url).toContain('acme.test');
  });
});
