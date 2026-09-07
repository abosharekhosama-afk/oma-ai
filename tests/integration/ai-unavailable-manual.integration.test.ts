import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  approveProfile,
  createRedisConnection,
  fullScanJourney,
  getProfile,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('ai unavailable manual integration', () => {
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

  it('manual path approves with NOT_CONFIGURED ai', async () => {
    const journey = await fullScanJourney(seed, connection);
    expect(journey.scan.ai_availability).toBe('NOT_CONFIGURED');
    const versionId = journey.profileVersionId!;
    const { body: profile } = await getProfile(seed, journey.brandId, versionId);
    expect(profile.data.ai_availability).toBe('NOT_CONFIGURED');
    const approved = await approveProfile(
      seed,
      journey.brandId,
      versionId,
      profile.data.row_version,
    );
    expect([200, 201]).toContain(approved.res.status);
    expect(approved.body.data.status).toBe('APPROVED');
  });
});
