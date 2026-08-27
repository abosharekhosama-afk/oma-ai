import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  approveProfile,
  createRedisConnection,
  fullScanJourney,
  getProfile,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('partial approval integration', () => {
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

  it('partial scan requires acknowledge_incomplete then approves', async () => {
    const journey = await fullScanJourney(seed, connection, { max_pages: 1 });
    expect(journey.scan.status).toBe('PARTIAL');
    const versionId = journey.profileVersionId!;
    const { body: profile } = await getProfile(seed, journey.brandId, versionId);

    const denied = await approveProfile(
      seed,
      journey.brandId,
      versionId,
      profile.data.row_version,
      {
        acknowledge_incomplete: false,
        confirm_summary: true,
      },
    );
    expect(denied.res.status).toBe(422);

    const ok = await approveProfile(seed, journey.brandId, versionId, profile.data.row_version, {
      acknowledge_incomplete: true,
      confirm_summary: true,
    });
    expect([200, 201]).toContain(ok.res.status);
  });
});
