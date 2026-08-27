import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { Queue, QueueEvents } from 'bullmq';
import {
  buildIngestionJobData,
  bullIngestionJobId,
} from '../../apps/worker/src/processors/ingestion-job-payload';
import { startIngestionProcessor } from '../../apps/worker/src/processors/ingestion.processor';
import {
  connectWebsite,
  createBrand,
  createRedisConnection,
  FIXTURE_WEBSITE_URL,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';

describe('scan midflight reauthz security', () => {
  let connection: ReturnType<typeof createRedisConnection>;
  let queue: Queue;
  let events: QueueEvents;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    connection = createRedisConnection();
    queue = new Queue('ingestion', { connection });
    events = new QueueEvents('ingestion', { connection });
    await events.waitUntilReady();
  });

  afterAll(async () => {
    await events.close();
    await queue.close();
    await connection.quit();
    await seed.app.close();
  });

  it('suspended membership mid-job marks PERMISSION_DENIED', async () => {
    const prisma = getPrisma();
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });

    const worker = startIngestionProcessor(connection, {
      beforeHandle: async () => {
        entered();
        await gate;
      },
    });

    try {
      const { body: brand } = await createBrand(seed);
      await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
      const { body: scan } = await startScan(seed, brand.data.id, newId());
      const jobRunId = scan.data.job_run_id as string;
      const scanId = scan.data.scan_attempt_id as string;

      const bullJob = await queue.add(
        'ingestion.scan.started',
        buildIngestionJobData({
          jobRunId,
          tenantId: seed.tenantId,
          brandId: brand.data.id,
          scanAttemptId: scanId,
          actorUserId: seed.userId,
        }),
        { jobId: bullIngestionJobId(jobRunId), attempts: 1 },
      );

      await enteredPromise;
      await prisma.membership.update({
        where: { id: seed.membershipId },
        data: { status: 'SUSPENDED', suspendedAt: new Date() },
      });
      releaseGate();

      await expect(bullJob.waitUntilFinished(events, 30_000)).rejects.toBeTruthy();

      const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobRunId } });
      expect(jobRun.status).toBe('DEAD');
      expect(jobRun.errorCode).toBe('PERMISSION_DENIED');

      const attempt = await prisma.scanAttempt.findUniqueOrThrow({ where: { id: scanId } });
      expect(attempt.status).toBe('FAILED');
      expect(attempt.errorCode).toBe('PERMISSION_DENIED');
    } finally {
      await worker.close();
    }
  });
});
