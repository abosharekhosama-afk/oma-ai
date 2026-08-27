import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import {
  approveProfile,
  createRedisConnection,
  fullScanJourney,
  getProfile,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('profile approval contract', () => {
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

  it('approve with confirm_summary succeeds; without returns 422', async () => {
    const journey = await fullScanJourney(seed, connection);
    const versionId = journey.profileVersionId!;
    const { body: profile } = await getProfile(seed, journey.brandId, versionId);

    const denied = await approveProfile(
      seed,
      journey.brandId,
      versionId,
      profile.data.row_version,
      {
        acknowledge_incomplete: true,
        confirm_summary: false,
      },
    );
    expect(denied.res.status).toBe(422);
    expect(denied.body.error.code).toBe('APPROVAL_INELIGIBLE');

    const ok = await approveProfile(seed, journey.brandId, versionId, profile.data.row_version);
    expect([200, 201]).toContain(ok.res.status);
    expect(ok.body.data.status).toBe('APPROVED');
  });
});
