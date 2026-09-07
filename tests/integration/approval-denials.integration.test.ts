import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import type { INestApplication } from '@nestjs/common';
import {
  createRedisConnection,
  fullScanJourney,
  getProfile,
  approveProfile,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('approval denials integration', () => {
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

  it('cancelled scan profile cannot approve', async () => {
    const journey = await fullScanJourney(seed, connection);
    const versionId = journey.profileVersionId!;
    const { body: profile } = await getProfile(seed, journey.brandId, versionId);

    const prisma = getPrisma();
    await prisma.scanAttempt.update({
      where: { id: journey.scanId },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });

    const denied = await approveProfile(seed, journey.brandId, versionId, profile.data.row_version);
    expect(denied.res.status).toBe(422);
    expect(denied.body.error.code).toBe('APPROVAL_INELIGIBLE');
  });
});
