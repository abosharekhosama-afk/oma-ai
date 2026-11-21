import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { bullIngestionJobId } from '@oma/domain';
import { getPrisma } from '@oma/db';

function redisConnection(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

export type RequeueScanInput = {
  jobRunId: string;
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  actorUserId: string | null;
  correlationId: string | null;
  config?: {
    max_pages?: number;
    max_depth?: number;
    max_duration_seconds?: number;
  };
};

/** Re-queue the ingestion BullMQ job so a stalled or interrupted scan can continue. */
export async function requeueScanIngestionJob(
  input: RequeueScanInput,
): Promise<{ requeued: boolean; reason?: string }> {
  const conn = redisConnection();
  if (!conn) return { requeued: false, reason: 'redis_unavailable' };

  const prefix = process.env.BULLMQ_PREFIX || 'oma';
  const queue = new Queue('ingestion', { connection: conn, prefix });
  try {
    const jobId = bullIngestionJobId(input.jobRunId);
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active') {
        return { requeued: false, reason: 'job_active' };
      }
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
      {
        job_run_id: input.jobRunId,
        tenant_id: input.tenantId,
        brand_id: input.brandId,
        scan_attempt_id: input.scanAttemptId,
        actor_user_id: input.actorUserId,
        correlation_id: input.correlationId,
        config: input.config,
      },
      {
        jobId,
        attempts: 5,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await getPrisma().$transaction([
      getPrisma().jobRun.updateMany({
        where: {
          id: input.jobRunId,
          status: { notIn: ['SUCCEEDED', 'CANCELLED'] },
        },
        data: {
          status: 'QUEUED',
          finishedAt: null,
          errorCode: null,
          errorDetail: null,
        },
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
    await conn.quit().catch(() => undefined);
  }
}
