import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import {
  cancelScan,
  connectWebsite,
  createBrand,
  createRedisConnection,
  FIXTURE_WEBSITE_URL,
  retryScan,
  runIngestionForJobRun,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';

describe('scan cancel retry integration', () => {
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

  it('cancel then retry creates new attempt', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const { body: started } = await startScan(seed, brand.data.id, newId());
    const scanId = started.data.scan_attempt_id as string;
    const cancelled = await cancelScan(seed, brand.data.id, scanId);
    expect([200, 201]).toContain(cancelled.res.status);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const retried = await retryScan(seed, brand.data.id, scanId, newId());
    expect(retried.res.status).toBe(202);
    const newScanId = retried.body.data.scan_attempt_id as string;
    expect(newScanId).not.toBe(scanId);

    await runIngestionForJobRun(connection, retried.body.data.job_run_id as string);
    const prisma = getPrisma();
    const parent = await prisma.scanAttempt.findUniqueOrThrow({ where: { id: scanId } });
    const child = await prisma.scanAttempt.findUniqueOrThrow({ where: { id: newScanId } });
    expect(parent.status).toBe('CANCELLED');
    expect(child.parentAttemptId).toBe(scanId);
  });
});
