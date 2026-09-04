import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId, type MailMessage, type MailProviderPort } from '@oma/domain';
import IORedis from 'ioredis';
import { Queue, QueueEvents } from 'bullmq';
import { bullmqOptions } from '../helpers/bullmq-options';
import { startMailProcessor } from '../../apps/worker/src/processors/mail.processor';
import { buildMailJobData, bullMailJobId } from '../../apps/worker/src/processors/mail-job-payload';
import { resetBullQueues } from '../helpers/bullmq-cleanup';

class MemoryMailAdapter implements MailProviderPort {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe('worker reauthz', () => {
  let connection: IORedis;
  let queue: Queue;
  let events: QueueEvents;

  beforeAll(async () => {
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
    });
    queue = new Queue('mail', { connection, ...bullmqOptions() });
    events = new QueueEvents('mail', { connection, ...bullmqOptions() });
    await events.waitUntilReady();
    await resetBullQueues(connection, ['mail']);
  });

  afterAll(async () => {
    await events.close();
    await queue.close();
    await connection.quit();
  });

  it('re-queries membership mid-flight and marks job DEAD with PERMISSION_DENIED without sending mail', async () => {
    const prisma = getPrisma();
    const mail = new MemoryMailAdapter();

    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    let signalEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve;
    });

    const worker = startMailProcessor(connection, {
      mail,
      beforeHandle: async () => {
        signalEntered();
        await gate;
      },
    });

    try {
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
      const membership = await prisma.membership.create({
        data: {
          id: newId(),
          tenantId: tenant.id,
          userId: user.id,
          status: 'ACTIVE',
        },
      });
      const jobRun = await prisma.jobRun.create({
        data: {
          id: newId(),
          tenantId: tenant.id,
          queue: 'mail',
          jobType: 'mail.invite',
          status: 'QUEUED',
          payloadJson: JSON.stringify({ to: user.email }),
          actorUserId: user.id,
          idempotencyKey: `reauthz:${newId()}`,
        },
      });

      const bullJob = await queue.add(
        'mail.invite',
        buildMailJobData({
          jobRunId: jobRun.id,
          outboxId: newId(),
          tenantId: tenant.id,
          actorUserId: user.id,
          payload: { to: user.email },
        }),
        {
          jobId: bullMailJobId(jobRun.id),
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      await entered;

      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: 'SUSPENDED', suspendedAt: new Date() },
      });
      releaseGate();

      await expect(bullJob.waitUntilFinished(events, 15_000)).rejects.toBeTruthy();

      const updated = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobRun.id } });
      expect(updated.status).toBe('DEAD');
      expect(updated.errorCode).toBe('PERMISSION_DENIED');
      expect(mail.sent.filter((m) => m.to === user.email)).toHaveLength(0);
    } finally {
      await worker.close();
    }
  });
});
