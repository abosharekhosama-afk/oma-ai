import { getPrisma } from '@oma/db';
import type { MailMessage, MailProviderPort } from '@oma/domain';
import {
  inviteAcceptLink,
  pickMailLocale,
  renderInviteEmail,
  renderPasswordResetEmail,
} from '@oma/domain';
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

const webOrigin = () => process.env.WEB_ORIGIN || 'http://127.0.0.1:3000';

/** Build the real email for known job types; fall back to the payload text otherwise. */
export async function composeMail(
  jobName: string,
  payload: MailJobPayload['payload'],
  ctx: { tenantId: string | null; actorUserId: string | null },
): Promise<MailMessage> {
  const to = payload.to as string;
  const prisma = getPrisma();
  if (jobName === 'mail.invite' && payload.token) {
    const [recipient, inviter, tenant] = await Promise.all([
      prisma.user.findUnique({ where: { email: to } }),
      ctx.actorUserId ? prisma.user.findUnique({ where: { id: ctx.actorUserId } }) : null,
      ctx.tenantId ? prisma.tenant.findUnique({ where: { id: ctx.tenantId } }) : null,
    ]);
    const rendered = renderInviteEmail({
      locale: pickMailLocale(
        recipient?.preferredLocale,
        inviter?.preferredLocale,
        tenant?.defaultLocale,
      ),
      acceptUrl: inviteAcceptLink(webOrigin(), payload.token),
      companyName: tenant?.name,
      inviterName: inviter?.name,
    });
    return { to, ...rendered };
  }
  if (jobName === 'mail.recovery' && payload.token) {
    const user = await prisma.user.findUnique({ where: { email: to } });
    const rendered = renderPasswordResetEmail({
      locale: pickMailLocale(user?.preferredLocale),
      resetUrl: `${webOrigin().replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(payload.token)}`,
      name: user?.name,
    });
    return { to, ...rendered };
  }
  return {
    to,
    subject: payload.subject ?? `OMA: ${jobName}`,
    text: payload.text ?? `OMA job ${jobName}`,
  };
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

      const message = await composeMail(job.name, payload, {
        tenantId: jobRun.tenantId,
        actorUserId: jobRun.actorUserId,
      });
      try {
        await mail.send(message);
      } catch (err) {
        // Provider errors are already redacted; record and let BullMQ retry.
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            errorCode: 'MAIL_SEND_FAILED',
            errorDetail: (err instanceof Error ? err.message : String(err)).slice(0, 500),
          },
        });
        log.error({ jobRunId: jobRun.id, jobName: job.name }, 'mail send failed');
        throw err;
      }

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
