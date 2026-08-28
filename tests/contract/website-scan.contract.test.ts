import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import {
  authHeaders,
  connectWebsite,
  createBrand,
  FIXTURE_WEBSITE_URL,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';

describe('website scan contract', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('POST scan requires Idempotency-Key', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brand.data.id}/scans`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: '{}',
    });
    expect(res.status).toBe(400);
  });

  it('POST scan returns 202 with attempt id', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const { res, body } = await startScan(seed, brand.data.id, newId());
    expect(res.status).toBe(202);
    expect(body.data.scan_attempt_id).toBeTruthy();
    expect(body.data.job_run_id).toBeTruthy();
    expect(body.data.status).toBe('QUEUED');
  });

  it('GET scan status by id', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const { body: started } = await startScan(seed, brand.data.id, newId());
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/scans/${started.data.scan_attempt_id}`,
      { headers: { cookie: `oma_session=${seed.cookies.oma_session}` } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(started.data.scan_attempt_id);
  });

  it('scan and brand responses disclose connector provenance separately', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const { body: started } = await startScan(seed, brand.data.id, newId());

    const scanRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/scans/${started.data.scan_attempt_id}`,
      { headers: { cookie: `oma_session=${seed.cookies.oma_session}` } },
    );
    const scanBody = await scanRes.json();
    // Stored on the attempt, so a queued scan reports the default until the
    // worker records the connector it actually used.
    expect(['FIXTURE', 'NOT_CONFIGURED']).toContain(scanBody.data.connector_mode);

    const brandRes = await fetch(`${seed.baseUrl}/api/v1/brands/${brand.data.id}`, {
      headers: { cookie: `oma_session=${seed.cookies.oma_session}` },
    });
    const brandBody = await brandRes.json();
    expect(['FIXTURE', 'NOT_CONFIGURED']).toContain(brandBody.data.next_scan_connector_mode);
    expect(brandBody.data.latest_scan.connector_mode).toBe(scanBody.data.connector_mode);
  });
});
