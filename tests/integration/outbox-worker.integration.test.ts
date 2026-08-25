import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma, writeOutbox } from '@oma/db';
import IORedis from 'ioredis';
import { publishPendingOutbox } from '../../apps/worker/src/processors/outbox.publisher';
import { Queue } from 'bullmq';

describe('outbox worker Q-08', () => {
  let connection: IORedis;
  beforeAll(() => {
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
    });
  });
  afterAll(async () => {
    await connection.quit();
  });

  it('publishes pending outbox to mail queue via publisher', async () => {
    const prisma = getPrisma();
    const event = await writeOutbox(prisma, {
      tenantId: null,
      eventType: 'mail.test',
      payload: { to: 'test@example.com' },
    });
    const count = await publishPendingOutbox(connection, 100);
    expect(count).toBeGreaterThanOrEqual(1);
    const updated = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe('PUBLISHED');

    const mailQueue = new Queue('mail', { connection });
    const waiting = await mailQueue.getJobs(['waiting', 'delayed', 'active', 'completed']);
    expect(waiting.some((j) => j.data?.outboxId === event.id || j.name === 'mail.test')).toBe(true);
    await mailQueue.close();
  });
});
