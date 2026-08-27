import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import {
  connectWebsite,
  createBrand,
  createRedisConnection,
  FIXTURE_WEBSITE_URL,
  runIngestionForJobRun,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';

describe('scan job correlation integration', () => {
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

  it('JobRun id matches ScanAttempt.jobRunId after ingestion', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const { body: scan } = await startScan(seed, brand.data.id, newId());
    const jobRunId = scan.data.job_run_id as string;
    const scanId = scan.data.scan_attempt_id as string;
    await runIngestionForJobRun(connection, jobRunId);

    const prisma = getPrisma();
    const attempt = await prisma.scanAttempt.findUniqueOrThrow({ where: { id: scanId } });
    const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobRunId } });
    expect(attempt.jobRunId).toBe(jobRunId);
    expect(jobRun.id).toBe(jobRunId);
    expect(['SUCCEEDED', 'FAILED']).toContain(jobRun.status);
  });
});
