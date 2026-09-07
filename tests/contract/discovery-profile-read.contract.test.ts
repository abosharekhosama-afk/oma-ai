import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  authHeaders,
  createRedisConnection,
  fullScanJourney,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('discovery read contract', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let connection: ReturnType<typeof createRedisConnection>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
    connection = createRedisConnection();
  });
  afterAll(async () => {
    await connection.quit();
    await app.close();
  });

  it('lists pages, products, evidence for scan', async () => {
    const journey = await fullScanJourney(seed, connection, { max_pages: 3 });
    const pages = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/scans/${journey.scanId}/pages`,
      { headers: { cookie: authHeaders(seed).cookie } },
    );
    expect(pages.status).toBe(200);
    const pagesBody = await pages.json();
    expect(pagesBody.data.length).toBeGreaterThan(0);

    const products = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/scans/${journey.scanId}/products`,
      { headers: { cookie: authHeaders(seed).cookie } },
    );
    expect(products.status).toBe(200);

    const evidence = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/scans/${journey.scanId}/evidence`,
      { headers: { cookie: authHeaders(seed).cookie } },
    );
    expect(evidence.status).toBe(200);
    const evidenceBody = await evidence.json();
    expect(evidenceBody.data.length).toBeGreaterThan(0);

    const evidenceId = evidenceBody.data[0].id as string;
    const one = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/evidence/${evidenceId}`,
      { headers: { cookie: authHeaders(seed).cookie } },
    );
    expect(one.status).toBe(200);
  });
});
