import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import {
  approveProfile,
  createRedisConnection,
  fullScanJourney,
  getProfile,
  runIngestionForJobRun,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';

describe('rescan new draft integration', () => {
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

  it('rescan creates new draft; approved unchanged until new approval', async () => {
    const journey = await fullScanJourney(seed, connection);
    const v1Id = journey.profileVersionId!;
    const { body: v1 } = await getProfile(seed, journey.brandId, v1Id);
    await approveProfile(seed, journey.brandId, v1Id, v1.data.row_version);

    const { body: rescan } = await startScan(seed, journey.brandId, newId(), { max_pages: 2 });
    await runIngestionForJobRun(connection, rescan.data.job_run_id as string);

    const prisma = getPrisma();
    const brand = await prisma.brandWorkspace.findUniqueOrThrow({
      where: { id: journey.brandId },
    });
    expect(brand.currentApprovedProfileVersionId).toBe(v1Id);

    const drafts = await prisma.profileVersion.findMany({
      where: { brandId: journey.brandId, status: { in: ['DRAFT', 'NEEDS_REVIEW'] } },
    });
    expect(drafts.length).toBeGreaterThan(0);

    const v1After = await prisma.profileVersion.findUniqueOrThrow({ where: { id: v1Id } });
    expect(v1After.status).toBe('APPROVED');
  });
});
