import { getPrisma } from '@oma/db';
import { createLogger } from '@oma/observability';
import { Queue, Worker } from 'bullmq';
import type IORedis from 'ioredis';

const log = createLogger('outbox-processor');

export function startOutboxProcessor(connection: IORedis) {
  const mailQueue = new Queue('mail', { connection });

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
            await mailQueue.add(event.eventType, {
              outboxId: event.id,
              tenantId: event.tenantId,
              payload: JSON.parse(event.payloadJson),
            });
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
    { connection, concurrency: 1 },
  );

  // poll trigger
  setInterval(() => {
    void mailQueue.client.then(() => worker.run()).catch(() => undefined);
  }, 2000);

  // simpler: dedicated interval job
  setInterval(async () => {
    try {
      await mailQueue.add('outbox.tick', {});
    } catch {
      /* ignore */
    }
  }, 2000);

  return worker;
}

export async function enqueueOutboxTick(connection: IORedis) {
  const q = new Queue('outbox', { connection });
  await q.add('tick', {}, { removeOnComplete: true, repeat: { every: 2000 } });
}
