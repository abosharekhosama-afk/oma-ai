import { getPrisma } from '@oma/db';
import type { MailProviderPort } from '@oma/domain';
import { createLogger } from '@oma/observability';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { createMailAdapter } from '../mail/create-mail-adapter';
import { materializeNotification } from './notification.processor';
import type { MailJobPayload } from './mail-job-payload';

const log = createLogger('mail-processor');

async function reauthz(
  tenantId: string | null | undefined,
  actorUserId: string | null | undefined,
) {
  if (!tenantId || !actorUserId) return true;
  const membership = await getPrisma().membership.findFirst({
    where: { tenantId, userId: actorUserId, status: 'ACTIVE' },
  });
  return Boolean(membership);
}

export type MailProcessorOptions = {
  mail?: MailProviderPort;
  /** Test hook: runs after JobRun load, before re-authz / send (mid-flight latch). */
  beforeHandle?: (job: Job<MailJobPayload>) => Promise<void>;
};

export function startMailProcessor(connection: IORedis, options: MailProcessorOptions = {}) {
  const mail = options.mail ?? createMailAdapter(connection);

  return new Worker<MailJobPayload>(
    'mail',
    async (job) => {
      const prisma = getPrisma();
      const data = job.data;
      const jobRunId = data.job_run_id;

      if (!jobRunId || typeof jobRunId !== 'string') {
        throw new Error('missing job_run_id');
      }

      const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId } });
      if (!jobRun) {
        throw new Error(`job_run not found: ${jobRunId}`);
      }

      if (jobRun.status === 'SUCCEEDED') {
        return { ok: true, skipped: true };
      }
      if (jobRun.status === 'DEAD' || jobRun.status === 'CANCELLED') {
        throw new Error(`job_run terminal: ${jobRun.status}`);
      }

      // Tenant in payload is a hint only — authoritative tenant is JobRun.tenantId.
      if (data.tenant_id && jobRun.tenantId && data.tenant_id !== jobRun.tenantId) {
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: 'DEAD',
            errorCode: 'TENANT_MISMATCH',
            errorDetail: 'payload tenant_id does not match job_run',
            finishedAt: new Date(),
          },
        });
        throw new Error('tenant mismatch');
      }

      if (options.beforeHandle) {
        await options.beforeHandle(job);
      }

      const ok = await reauthz(jobRun.tenantId, jobRun.actorUserId);
      if (!ok) {
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: 'DEAD',
            errorCode: 'PERMISSION_DENIED',
            errorDetail: 'membership inactive',
            finishedAt: new Date(),
          },
        });
        throw new Error('worker reauthz failed');
      }

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const payload = data.payload ?? {};
      const to = payload.to;
      if (!to) {
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: 'DEAD',
            errorCode: 'INVALID_PAYLOAD',
            errorDetail: 'missing to',
            finishedAt: new Date(),
          },
        });
        throw new Error('missing mail recipient');
      }

      await mail.send({
        to,
        subject: payload.subject ?? `OMA: ${job.name}`,
        text: payload.text ?? `OMA job ${job.name}`,
      });

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { status: 'SUCCEEDED', finishedAt: new Date() },
      });

      if (jobRun.tenantId && jobRun.actorUserId) {
        await materializeNotification({
          tenantId: jobRun.tenantId,
          recipientUserId: jobRun.actorUserId,
          type: job.name,
          deepLinkPath: '/app',
          dedupeKey: `${jobRun.id}:${to}`,
          sourceOutboxEventId: data.outbox_id,
        });
      } else if (jobRun.tenantId) {
        log.warn({ jobRunId: jobRun.id }, 'skip notification: no actor');
      }

      return { ok: true, job_run_id: jobRun.id };
    },
    { connection, prefix: process.env.BULLMQ_PREFIX || 'oma', concurrency: 2 },
  );
}
