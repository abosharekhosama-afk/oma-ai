import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { bullAnalysisJobId, bullIngestionJobId } from '@oma/domain';
import { getPrisma } from '@oma/db';

function redisConnection(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

/** Best-effort: drop queued BullMQ work; active scans rely on cooperative cancel in the worker. */
export async function cancelScanQueueJobs(input: {
  tenantId: string;
  scanAttemptId: string;
  ingestionJobRunId: string;
}): Promise<void> {
  const conn = redisConnection();
  if (!conn) return;
  const prefix = process.env.BULLMQ_PREFIX || 'oma';
  const ingestionQueue = new Queue('ingestion', { connection: conn, prefix });
  const analysisQueue = new Queue('analysis', { connection: conn, prefix });
  try {
    const ingestionJob = await ingestionQueue.getJob(bullIngestionJobId(input.ingestionJobRunId));
    if (ingestionJob) {
      const state = await ingestionJob.getState();
      if (state === 'waiting' || state === 'delayed' || state === 'paused') {
        await ingestionJob.remove();
      }
    }

    const analysisRuns = await getPrisma().jobRun.findMany({
      where: {
        tenantId: input.tenantId,
        queue: 'analysis',
        status: { in: ['QUEUED', 'RUNNING'] },
        payloadJson: { contains: input.scanAttemptId },
      },
      select: { id: true },
      take: 20,
    });
    for (const run of analysisRuns) {
      await getPrisma().jobRun.updateMany({
        where: { id: run.id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: 'CANCELLED', finishedAt: new Date() },
      });
      const job = await analysisQueue.getJob(bullAnalysisJobId(run.id));
      if (job) {
        const state = await job.getState();
        if (state === 'waiting' || state === 'delayed' || state === 'paused') {
          await job.remove();
        }
      }
    }
  } finally {
    await ingestionQueue.close();
    await analysisQueue.close();
    await conn.quit();
  }
}
