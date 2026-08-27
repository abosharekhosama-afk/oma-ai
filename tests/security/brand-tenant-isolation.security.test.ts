import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  createBrand,
  createRedisConnection,
  fullScanJourney,
  seedBrandTenant,
} from '../helpers/brand-test';

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
    await t2.app.close();
  });

  function foreignSessionHeaders() {
    return { cookie: `oma_session=${t2.cookies.oma_session}` };
  }

  it('denies cross-tenant brand read', async () => {
    const { body: brand } = await createBrand(t1);
    const probe = await fetch(`${t1.baseUrl}/api/v1/brands/${brand.data.id}`, {
      headers: foreignSessionHeaders(),
    });
    expect(probe.status).toBe(404);
  });

  it('denies cross-tenant scan read', async () => {
    const connection = createRedisConnection();
    try {
      const journey = await fullScanJourney(t1, connection);
      const probe = await fetch(
        `${t1.baseUrl}/api/v1/brands/${journey.brandId}/scans/${journey.scanId}`,
        { headers: foreignSessionHeaders() },
      );
      expect(probe.status).toBe(404);
    } finally {
      await connection.quit();
    }
  });

  it('denies cross-tenant profile read', async () => {
    const connection = createRedisConnection();
    try {
      const journey = await fullScanJourney(t1, connection);
      const versionId = journey.profileVersionId;
      expect(versionId).toBeTruthy();
      const probe = await fetch(
        `${t1.baseUrl}/api/v1/brands/${journey.brandId}/profiles/${versionId}`,
        { headers: foreignSessionHeaders() },
      );
      expect(probe.status).toBe(404);
    } finally {
      await connection.quit();
    }
  });

  it('denies cross-tenant evidence list', async () => {
    const connection = createRedisConnection();
    try {
      const journey = await fullScanJourney(t1, connection);
      const probe = await fetch(
        `${t1.baseUrl}/api/v1/brands/${journey.brandId}/scans/${journey.scanId}/evidence`,
        { headers: foreignSessionHeaders() },
      );
      expect(probe.status).toBe(404);
    } finally {
      await connection.quit();
    }
  });
});
