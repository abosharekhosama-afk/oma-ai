import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import {
  connectWebsite,
  createBrand,
  FIXTURE_WEBSITE_URL,
  pollScanUntil,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';
import { startWorkerProcess } from '../helpers/worker-process';

describe('scan outbox bullmq worker integration', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('API startScan → outbox → BullMQ worker → status API → DB result', async () => {
    const worker = await startWorkerProcess();
    try {
      const prisma = getPrisma();
      const { body: brand } = await createBrand(seed);
      const brandId = brand.data.id as string;
      await connectWebsite(seed, brandId, FIXTURE_WEBSITE_URL, brand.data.version);
      const { body: scan, res } = await startScan(seed, brandId, newId());
      expect(res.status).toBe(202);

      const scanId = scan.data.scan_attempt_id as string;
      const jobRunId = scan.data.job_run_id as string;

      const outbox = await prisma.outboxEvent.findFirst({
        where: { payloadJson: { contains: jobRunId } },
        orderBy: { createdAt: 'desc' },
      });
      expect(outbox).toBeTruthy();
      expect(outbox!.status).toBe('PENDING');

      const finished = await pollScanUntil(
        seed,
        brandId,
        scanId,
        ['PARTIAL', 'SUCCEEDED', 'FAILED'],
        90_000,
      );
      expect(['PARTIAL', 'SUCCEEDED']).toContain(finished.status);

      const published = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outbox!.id } });
      expect(published.status).toBe('PUBLISHED');

      const jobRun = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobRunId } });
      expect(jobRun.status).toBe('SUCCEEDED');
      expect(jobRun.id).toBe(jobRunId);

      const attempt = await prisma.scanAttempt.findUniqueOrThrow({ where: { id: scanId } });
      expect(attempt.jobRunId).toBe(jobRunId);
      expect(attempt.progressPercent).toBe(100);
    } finally {
      await worker.stop();
    }
  });
});
