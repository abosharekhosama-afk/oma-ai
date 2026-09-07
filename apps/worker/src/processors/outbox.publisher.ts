import { getPrisma } from '@oma/db';
import { createLogger } from '@oma/observability';
import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import { buildMailJobData, bullMailJobId } from './mail-job-payload';
import { buildIngestionJobData, bullIngestionJobId } from './ingestion-job-payload';

const log = createLogger('outbox-publisher');

type OutboxMailPayload = {
  to?: string;
  token?: string;
  membershipId?: string;
  subject?: string;
  text?: string;
  jobRunId?: string;
  actorUserId?: string;
  correlationId?: string;
  idempotencyKey?: string;
};

type OutboxIngestionPayload = {
  jobRunId?: string;
  scanAttemptId?: string;
  tenantId?: string;
  brandId?: string;
  actorUserId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  config?: { max_pages?: number; max_depth?: number; max_duration_seconds?: number };
};

/** Publish PENDING outbox rows into BullMQ queues (real worker path). */
export async function publishPendingOutbox(connection: IORedis, limit = 50): Promise<number> {
  const prisma = getPrisma();
  const mailQueue = new Queue('mail', { connection, prefix: process.env.BULLMQ_PREFIX || 'oma' });
  const ingestionQueue = new Queue('ingestion', {
    connection,
    prefix: process.env.BULLMQ_PREFIX || 'oma',
  });
  const pending = await prisma.outboxEvent.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  let published = 0;
  for (const event of pending) {
    try {
      if (event.eventType.startsWith('mail.')) {
        const payload = JSON.parse(event.payloadJson) as OutboxMailPayload;
        const jobRunId = payload.jobRunId;
        if (!jobRunId) {
          throw new Error(`outbox ${event.id} missing jobRunId`);
        }
        const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId } });
        if (!jobRun) {
          throw new Error(`outbox ${event.id} jobRun ${jobRunId} not found`);
        }
        if (jobRun.tenantId && event.tenantId && jobRun.tenantId !== event.tenantId) {
          throw new Error(`outbox ${event.id} tenant mismatch vs jobRun`);
        }

        await mailQueue.add(
          event.eventType,
          buildMailJobData({
            jobRunId: jobRun.id,
            outboxId: event.id,
            tenantId: jobRun.tenantId,
            actorUserId: jobRun.actorUserId,
            correlationId: jobRun.correlationId ?? payload.correlationId ?? null,
            idempotencyKey: jobRun.idempotencyKey ?? payload.idempotencyKey ?? null,
            payload: {
              to: payload.to,
              token: payload.token,
              membershipId: payload.membershipId,
              subject: payload.subject,
              text: payload.text,
            },
          }),
          {
            jobId: bullMailJobId(jobRun.id),
            attempts: 5,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
      } else if (event.eventType.startsWith('ingestion.')) {
        const payload = JSON.parse(event.payloadJson) as OutboxIngestionPayload;
        const jobRunId = payload.jobRunId;
        if (!jobRunId || !payload.scanAttemptId || !payload.brandId) {
          throw new Error(`outbox ${event.id} missing ingestion fields`);
        }
        const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId } });
        if (!jobRun) {
          throw new Error(`outbox ${event.id} jobRun ${jobRunId} not found`);
        }
        if (jobRun.tenantId && event.tenantId && jobRun.tenantId !== event.tenantId) {
          throw new Error(`outbox ${event.id} tenant mismatch vs jobRun`);
        }

        await ingestionQueue.add(
          event.eventType,
          buildIngestionJobData({
            jobRunId: jobRun.id,
            outboxId: event.id,
            tenantId: jobRun.tenantId,
            brandId: payload.brandId,
            scanAttemptId: payload.scanAttemptId,
            actorUserId: jobRun.actorUserId ?? payload.actorUserId ?? null,
            correlationId: jobRun.correlationId ?? payload.correlationId ?? null,
            idempotencyKey: jobRun.idempotencyKey ?? payload.idempotencyKey ?? null,
            config: payload.config,
          }),
          {
            jobId: bullIngestionJobId(jobRun.id),
            attempts: 5,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
      }
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
      });
      published += 1;
    } catch (err) {
      log.error({ err, id: event.id }, 'outbox publish failed');
      const attempts = event.attempts + 1;
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: attempts >= 5 ? 'FAILED' : 'PENDING',
          attempts,
        },
      });
    }
  }
  await mailQueue.close();
  await ingestionQueue.close();
  return published;
}
