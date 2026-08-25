import { getPrisma } from '@oma/db';
import { createLogger } from '@oma/observability';
import { Queue } from 'bullmq';
import type IORedis from 'ioredis';

const log = createLogger('outbox-publisher');

/** Publish PENDING outbox rows into BullMQ queues (real worker path). */
export async function publishPendingOutbox(connection: IORedis, limit = 50): Promise<number> {
  const prisma = getPrisma();
  const mailQueue = new Queue('mail', { connection });
  const pending = await prisma.outboxEvent.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  let published = 0;
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
  return published;
}
