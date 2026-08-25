import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma, writeOutbox } from '@oma/db';
import { newId } from '@oma/domain';
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

  it('publishes pending outbox to mail queue via publisher with explicit job_run_id', async () => {
    const prisma = getPrisma();
    const jobRunId = newId();
    await prisma.jobRun.create({
      data: {
        id: jobRunId,
        tenantId: null,
        queue: 'mail',
        jobType: 'mail.test',
        status: 'QUEUED',
        payloadJson: JSON.stringify({ to: 'test@example.com' }),
        idempotencyKey: `outbox-test:${jobRunId}`,
      },
    });
    const event = await writeOutbox(prisma, {
      tenantId: null,
      eventType: 'mail.test',
      payload: { to: 'test@example.com', jobRunId },
    });
    const count = await publishPendingOutbox(connection, 100);
    expect(count).toBeGreaterThanOrEqual(1);
    const updated = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe('PUBLISHED');

    const mailQueue = new Queue('mail', { connection });
    const waiting = await mailQueue.getJobs(['waiting', 'delayed', 'active', 'completed']);
    const matched = waiting.find(
      (j) => j.data?.job_run_id === jobRunId || j.data?.outbox_id === event.id,
    );
    expect(matched).toBeTruthy();
    expect(matched?.data?.job_run_id).toBe(jobRunId);
    await mailQueue.close();
  });
});
