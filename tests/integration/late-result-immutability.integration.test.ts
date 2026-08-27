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

describe('late result immutability integration', () => {
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

  it('approved version unchanged when late scan completes', async () => {
    const journey = await fullScanJourney(seed, connection);
    const versionId = journey.profileVersionId!;
    const { body: profile } = await getProfile(seed, journey.brandId, versionId);
    await approveProfile(seed, journey.brandId, versionId, profile.data.row_version);

    const approvedBefore = await getPrisma().profileVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    const sectionsBefore = approvedBefore.sectionsJson;

    const { body: rescan } = await startScan(seed, journey.brandId, newId(), { max_pages: 1 });
    await runIngestionForJobRun(connection, rescan.data.job_run_id as string);

    const approvedAfter = await getPrisma().profileVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    expect(approvedAfter.status).toBe('APPROVED');
    expect(approvedAfter.sectionsJson).toBe(sectionsBefore);
  });
});
