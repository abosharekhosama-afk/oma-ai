import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import IORedis from 'ioredis';
import { Queue, QueueEvents } from 'bullmq';
import { startMailProcessor } from '../../apps/worker/src/processors/mail.processor';

describe('worker reauthz', () => {
  let connection: IORedis;
  let queue: Queue;
  let events: QueueEvents;
  let worker: ReturnType<typeof startMailProcessor>;

  beforeAll(async () => {
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
    });
    queue = new Queue('mail', { connection });
    events = new QueueEvents('mail', { connection });
    await events.waitUntilReady();
    worker = startMailProcessor(connection);
  });

  afterAll(async () => {
    await worker.close();
    await events.close();
    await queue.close();
    await connection.quit();
  });

  it('marks job dead when membership suspended mid-flight', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({
      data: {
        id: newId(),
        email: `reauth-${newId().toLowerCase()}@example.com`,
        name: 'R',
        status: 'ACTIVE',
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        id: newId(),
        name: 'R',
        slug: `r-${newId().toLowerCase().slice(-6)}`,
        status: 'ACTIVE',
      },
    });
    await prisma.membership.create({
      data: { id: newId(), tenantId: tenant.id, userId: user.id, status: 'SUSPENDED' },
    });
    const job = await prisma.jobRun.create({
      data: {
        id: newId(),
        tenantId: tenant.id,
        queue: 'mail',
        jobType: 'mail.invite',
        status: 'QUEUED',
        payloadJson: JSON.stringify({ to: user.email }),
        actorUserId: user.id,
      },
    });

    const bullJob = await queue.add(
      'mail.invite',
      {
        outboxId: newId(),
        tenantId: tenant.id,
        actorUserId: user.id,
        payload: { to: user.email },
      },
      { attempts: 1, removeOnComplete: true, removeOnFail: false },
    );

    await expect(bullJob.waitUntilFinished(events, 15_000)).rejects.toBeTruthy();

    const updated = await prisma.jobRun.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe('DEAD');
    expect(updated.errorCode).toBe('PERMISSION_DENIED');
  });
});
