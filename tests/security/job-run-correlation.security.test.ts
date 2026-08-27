import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId, type MailMessage, type MailProviderPort } from '@oma/domain';
import IORedis from 'ioredis';
import { Queue, QueueEvents } from 'bullmq';
import { startMailProcessor } from '../../apps/worker/src/processors/mail.processor';
import { buildMailJobData, bullMailJobId } from '../../apps/worker/src/processors/mail-job-payload';
import { resetBullQueues } from '../helpers/bullmq-cleanup';

class MemoryMailAdapter implements MailProviderPort {
  readonly sent: MailMessage[] = [];
  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

describe('jobRun correlation', () => {
  let connection: IORedis;
  let queue: Queue;
  let events: QueueEvents;
  let worker: ReturnType<typeof startMailProcessor>;
  let mail: MemoryMailAdapter;

  beforeAll(async () => {
    connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: null,
    });
    queue = new Queue('mail', { connection });
    events = new QueueEvents('mail', { connection });
    await events.waitUntilReady();
    await resetBullQueues(connection, ['mail']);
    mail = new MemoryMailAdapter();
    worker = startMailProcessor(connection, { mail });
  });

  afterAll(async () => {
    await worker.close();
    await events.close();
    await queue.close();
    await connection.quit();
  });

  it('updates only the correlated JobRun when two concurrent jobs share tenant and queue', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({
      data: {
        id: newId(),
        email: `corr-${newId().toLowerCase()}@example.com`,
        name: 'C',
        status: 'ACTIVE',
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        id: newId(),
        name: 'C',
        slug: `c-${newId().toLowerCase().slice(-6)}`,
        status: 'ACTIVE',
      },
    });
    await prisma.membership.create({
      data: {
        id: newId(),
        tenantId: tenant.id,
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    const jobA = await prisma.jobRun.create({
      data: {
        id: newId(),
        tenantId: tenant.id,
        queue: 'mail',
        jobType: 'mail.invite',
        status: 'QUEUED',
        payloadJson: JSON.stringify({ to: `a-${user.email}` }),
        actorUserId: user.id,
        idempotencyKey: `corr-a:${newId()}`,
      },
    });
    const jobB = await prisma.jobRun.create({
      data: {
        id: newId(),
        tenantId: tenant.id,
        queue: 'mail',
        jobType: 'mail.invite',
        status: 'QUEUED',
        payloadJson: JSON.stringify({ to: `b-${user.email}` }),
        actorUserId: user.id,
        idempotencyKey: `corr-b:${newId()}`,
      },
    });

    const bullA = await queue.add(
      'mail.invite',
      buildMailJobData({
        jobRunId: jobA.id,
        outboxId: newId(),
        tenantId: tenant.id,
        actorUserId: user.id,
        payload: { to: `a-${user.email}` },
      }),
      { jobId: bullMailJobId(jobA.id), attempts: 1, removeOnComplete: true },
    );
    const bullB = await queue.add(
      'mail.invite',
      buildMailJobData({
        jobRunId: jobB.id,
        outboxId: newId(),
        tenantId: tenant.id,
        actorUserId: user.id,
        payload: { to: `b-${user.email}` },
      }),
      { jobId: bullMailJobId(jobB.id), attempts: 1, removeOnComplete: true },
    );

    await Promise.all([
      bullA.waitUntilFinished(events, 15_000),
      bullB.waitUntilFinished(events, 15_000),
    ]);

    const updatedA = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobA.id } });
    const updatedB = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobB.id } });
    expect(updatedA.status).toBe('SUCCEEDED');
    expect(updatedB.status).toBe('SUCCEEDED');
    expect(mail.sent.some((m) => m.to === `a-${user.email}`)).toBe(true);
    expect(mail.sent.some((m) => m.to === `b-${user.email}`)).toBe(true);
  });

  it('rejects payload tenant_id that does not match JobRun tenant and does not succeed', async () => {
    const prisma = getPrisma();
    const user = await prisma.user.create({
      data: {
        id: newId(),
        email: `xtenant-${newId().toLowerCase()}@example.com`,
        name: 'X',
        status: 'ACTIVE',
      },
    });
    const tenantA = await prisma.tenant.create({
      data: {
        id: newId(),
        name: 'A',
        slug: `a-${newId().toLowerCase().slice(-6)}`,
        status: 'ACTIVE',
      },
    });
    const tenantB = await prisma.tenant.create({
      data: {
        id: newId(),
        name: 'B',
        slug: `b-${newId().toLowerCase().slice(-6)}`,
        status: 'ACTIVE',
      },
    });
    await prisma.membership.create({
      data: {
        id: newId(),
        tenantId: tenantA.id,
        userId: user.id,
        status: 'ACTIVE',
      },
    });

    const jobRun = await prisma.jobRun.create({
      data: {
        id: newId(),
        tenantId: tenantA.id,
        queue: 'mail',
        jobType: 'mail.invite',
        status: 'QUEUED',
        payloadJson: JSON.stringify({ to: user.email }),
        actorUserId: user.id,
        idempotencyKey: `xtenant:${newId()}`,
      },
    });

    const beforeSent = mail.sent.length;
    const bullJob = await queue.add(
      'mail.invite',
      buildMailJobData({
        jobRunId: jobRun.id,
        outboxId: newId(),
        tenantId: tenantB.id,
        actorUserId: user.id,
        payload: { to: user.email },
      }),
      { jobId: bullMailJobId(jobRun.id), attempts: 1, removeOnComplete: true, removeOnFail: false },
    );

    await expect(bullJob.waitUntilFinished(events, 15_000)).rejects.toBeTruthy();
    const updated = await prisma.jobRun.findUniqueOrThrow({ where: { id: jobRun.id } });
    expect(updated.status).toBe('DEAD');
    expect(updated.errorCode).toBe('TENANT_MISMATCH');
    expect(mail.sent.length).toBe(beforeSent);
  });

  it('enforces unique JobRun.idempotencyKey so retries cannot create a duplicate row', async () => {
    const prisma = getPrisma();
    const key = `unique-key:${newId()}`;
    await prisma.jobRun.create({
      data: {
        id: newId(),
        tenantId: null,
        queue: 'mail',
        jobType: 'mail.test',
        status: 'QUEUED',
        payloadJson: '{}',
        idempotencyKey: key,
      },
    });
    await expect(
      prisma.jobRun.create({
        data: {
          id: newId(),
          tenantId: null,
          queue: 'mail',
          jobType: 'mail.test',
          status: 'QUEUED',
          payloadJson: '{}',
          idempotencyKey: key,
        },
      }),
    ).rejects.toBeTruthy();
  });
});
