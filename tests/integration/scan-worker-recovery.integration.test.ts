import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { Queue, QueueEvents } from 'bullmq';
import type { INestApplication } from '@nestjs/common';
import { publishPendingOutbox } from '../../apps/worker/src/processors/outbox.publisher';
import { bullIngestionJobId } from '../../apps/worker/src/processors/ingestion-job-payload';
import { startIngestionProcessor } from '../../apps/worker/src/processors/ingestion.processor';
import {
  connectWebsite,
  createBrand,
  createRedisConnection,
  FIXTURE_WEBSITE_URL,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';

describe('scan worker recovery integration', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let connection: ReturnType<typeof createRedisConnection>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
    connection = createRedisConnection();
    connection.on('error', () => undefined);
  });
  afterAll(async () => {
    await app.close();
    if (connection.status !== 'end') {
      await connection.quit();
    }
  });

  it('second processor run does not duplicate successful writes', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const { body: scan } = await startScan(seed, brand.data.id, newId());
    const jobRunId = scan.data.job_run_id as string;
    const scanId = scan.data.scan_attempt_id as string;

    const events = new QueueEvents('ingestion', { connection });
    await events.waitUntilReady();
    const queue = new Queue('ingestion', { connection });
    const worker = startIngestionProcessor(connection);
    try {
      await publishPendingOutbox(connection);
      const job = await queue.getJob(bullIngestionJobId(jobRunId));
      expect(job).toBeTruthy();
      await job!.waitUntilFinished(events, 90_000);

      const pagesAfterFirst = await getPrisma().discoveredPage.count({
        where: { scanAttemptId: scanId },
      });
      expect(pagesAfterFirst).toBeGreaterThan(0);

      await publishPendingOutbox(connection);
      const replay = await queue.getJob(bullIngestionJobId(jobRunId));
      if (replay) {
        await replay.waitUntilFinished(events, 90_000);
      }
    } finally {
      await worker.close();
      await events.close();
      await queue.close();
      await new Promise((r) => setTimeout(r, 150));
    }

    const prisma = getPrisma();
    const pages = await prisma.discoveredPage.count({ where: { scanAttemptId: scanId } });
    const observations = await prisma.extractedObservation.count({
      where: { scanAttemptId: scanId },
    });
    expect(pages).toBeGreaterThan(0);
    expect(observations).toBeGreaterThan(0);

    const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobRunId } });
    expect(['SUCCEEDED', 'FAILED']).toContain(jobRun.status);
  });
});
