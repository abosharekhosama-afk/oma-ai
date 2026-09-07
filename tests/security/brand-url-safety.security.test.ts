import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('brand url safety security', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('rejects http, credentials, private host, custom port', async () => {
    const { body: brand } = await createBrand(seed);
    const cases = [
      'http://acme.test/',
      'https://user:pass@acme.test/',
      'https://127.0.0.1/',
      'https://acme.test:8080/',
    ];
    for (const url of cases) {
      const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brand.data.id}/website`, {
        method: 'POST',
        headers: authHeaders(seed, { 'idempotency-key': url }),
        body: JSON.stringify({
          url,
          authorization_attested: true,
          version: brand.data.version,
        }),
      });
      expect(res.status).toBe(400);
    }
  });
});
