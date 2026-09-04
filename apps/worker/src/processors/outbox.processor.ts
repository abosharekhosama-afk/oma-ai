import { getPrisma } from '@oma/db';
import { createLogger } from '@oma/observability';
import { Queue, Worker } from 'bullmq';
import type IORedis from 'ioredis';
import { buildMailJobData, bullMailJobId } from './mail-job-payload';

const log = createLogger('outbox-processor');

export function startOutboxProcessor(connection: IORedis) {
  const mailQueue = new Queue('mail', { connection, prefix: process.env.BULLMQ_PREFIX || 'oma' });

  const worker = new Worker(
    'outbox',
    async () => {
      const prisma = getPrisma();
      const pending = await prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });
      for (const event of pending) {
        try {
          if (event.eventType.startsWith('mail.')) {
            const payload = JSON.parse(event.payloadJson) as {
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
            if (!payload.jobRunId) throw new Error(`outbox ${event.id} missing jobRunId`);
            const jobRun = await prisma.jobRun.findUnique({ where: { id: payload.jobRunId } });
            if (!jobRun) throw new Error(`jobRun ${payload.jobRunId} not found`);
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
              { jobId: bullMailJobId(jobRun.id), attempts: 5, removeOnComplete: true },
            );
          }
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 } },
          });
        } catch (e) {
          log.error({ err: e, id: event.id }, 'outbox publish failed');
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'FAILED', attempts: { increment: 1 } },
          });
        }
      }
      return { processed: pending.length };
    },
    { connection, prefix: process.env.BULLMQ_PREFIX || 'oma', concurrency: 1 },
  );

  return worker;
}

export async function enqueueOutboxTick(connection: IORedis) {
  const q = new Queue('outbox', { connection, prefix: process.env.BULLMQ_PREFIX || 'oma' });
  await q.add('tick', {}, { removeOnComplete: true, repeat: { every: 2000 } });
  await q.close();
}
