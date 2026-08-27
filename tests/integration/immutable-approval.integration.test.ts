import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import type { INestApplication } from '@nestjs/common';
import {
  approveProfile,
  authHeaders,
  createRedisConnection,
  fullScanJourney,
  getProfile,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('immutable approval integration', () => {
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

  it('creates unique ApprovalRecord and freezes approved version', async () => {
    const journey = await fullScanJourney(seed, connection);
    const versionId = journey.profileVersionId!;
    const { body: profile } = await getProfile(seed, journey.brandId, versionId);
    const approved = await approveProfile(
      seed,
      journey.brandId,
      versionId,
      profile.data.row_version,
    );
    expect([200, 201]).toContain(approved.res.status);

    const prisma = getPrisma();
    const records = await prisma.approvalRecord.findMany({
      where: { profileVersionId: versionId },
    });
    expect(records.length).toBe(1);

    const patch = await fetch(
      `${seed.baseUrl}/api/v1/brands/${journey.brandId}/profiles/${versionId}`,
      {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify({ row_version: profile.data.row_version + 1, sections: {} }),
      },
    );
    expect([403, 409]).toContain(patch.status);
  });
});
