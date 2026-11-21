import { getPrisma } from '@oma/db';
import { bullIngestionJobId, canResumeScan } from '@oma/domain';
import { createLogger } from '@oma/observability';
import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import {
  buildIngestionJobData,
  type IngestionJobPayload,
} from '../processors/ingestion-job-payload';

const log = createLogger('scan-ingestion-recovery');

function parseJobConfig(payloadJson: string | null): IngestionJobPayload['config'] {
  if (!payloadJson) return undefined;
  try {
    const parsed = JSON.parse(payloadJson) as { config?: IngestionJobPayload['config'] };
    return parsed.config;
  } catch {
    return undefined;
  }
}

export async function requeueScanIngestionJob(
  connection: IORedis,
  input: {
    jobRunId: string;
    tenantId: string;
    brandId: string;
    scanAttemptId: string;
    actorUserId: string | null;
    correlationId: string | null;
    config?: IngestionJobPayload['config'];
  },
): Promise<{ requeued: boolean; reason?: string }> {
  const prefix = process.env.BULLMQ_PREFIX || 'oma';
  const queue = new Queue('ingestion', { connection, prefix });
  try {
    const jobId = bullIngestionJobId(input.jobRunId);
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active') return { requeued: false, reason: 'job_active' };
      if (state === 'waiting' || state === 'delayed' || state === 'prioritized') {
        await getPrisma().scanAttempt.updateMany({
          where: {
            id: input.scanAttemptId,
            status: { notIn: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'] },
            cancelRequestedAt: null,
          },
          data: { progressUpdatedAt: new Date(), finishedAt: null },
        });
        return { requeued: false, reason: 'job_already_waiting' };
      }
      await existing.remove().catch(() => undefined);
    }

    await queue.add(
      'ingestion.scan.started',
      buildIngestionJobData({
        jobRunId: input.jobRunId,
        tenantId: input.tenantId,
        brandId: input.brandId,
        scanAttemptId: input.scanAttemptId,
        actorUserId: input.actorUserId,
        correlationId: input.correlationId,
        config: input.config,
      }),
      {
        jobId,
        attempts: 5,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await getPrisma().$transaction([
      getPrisma().jobRun.updateMany({
        where: { id: input.jobRunId, status: { notIn: ['SUCCEEDED', 'CANCELLED'] } },
        data: { status: 'QUEUED', finishedAt: null, errorCode: null, errorDetail: null },
      }),
      getPrisma().scanAttempt.updateMany({
        where: {
          id: input.scanAttemptId,
          status: { notIn: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'] },
          cancelRequestedAt: null,
        },
        data: {
          progressUpdatedAt: new Date(),
          errorCode: null,
          errorDetail: null,
          finishedAt: null,
        },
      }),
    ]);

    return { requeued: true };
  } finally {
    await queue.close().catch(() => undefined);
  }
}

export async function tickStalledBrandScans(connection: IORedis) {
  const stallSec = Number(process.env.BRAND_SCAN_PROGRESS_STALE_SECONDS ?? 90);
  const prisma = getPrisma();
  const scans = await prisma.scanAttempt.findMany({
    where: {
      status: { in: ['QUEUED', 'CRAWLING', 'EXTRACTING'] },
      cancelRequestedAt: null,
    },
    orderBy: { progressUpdatedAt: 'asc' },
    take: 40,
  });

  for (const scan of scans) {
    if (!scan.jobRunId) continue;
    const jobRun = await prisma.jobRun.findUnique({ where: { id: scan.jobRunId } });
    if (!jobRun) continue;

    const mayResume = canResumeScan({
      status: scan.status,
      cancelRequestedAt: scan.cancelRequestedAt,
      progressUpdatedAt: scan.progressUpdatedAt,
      startedAt: scan.startedAt,
      jobRunStatus: jobRun.status,
      stallSeconds: stallSec,
    });
    if (!mayResume) continue;

    const result = await requeueScanIngestionJob(connection, {
      jobRunId: jobRun.id,
      tenantId: scan.tenantId,
      brandId: scan.brandId,
      scanAttemptId: scan.id,
      actorUserId: jobRun.actorUserId,
      correlationId: jobRun.correlationId,
      config: parseJobConfig(jobRun.payloadJson),
    });
    if (result.requeued) {
      log.info({ scanId: scan.id, jobRunId: jobRun.id }, 'requeued stalled brand scan');
    }
  }
}