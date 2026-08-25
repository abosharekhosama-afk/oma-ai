import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import { createLogger } from '@oma/observability';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';

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

export function startMailProcessor(connection: IORedis) {
  return new Worker(
    'mail',
    async (job) => {
      const prisma = getPrisma();
      const tenantId = job.data.tenantId as string | undefined;
      const payload = job.data.payload as { to?: string; token?: string; membershipId?: string };
      const jobRun = await prisma.jobRun.findFirst({
        where: {
          queue: 'mail',
          status: 'QUEUED',
          ...(tenantId ? { tenantId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });

      if (jobRun) {
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
      }

      log.info({ to: payload?.to, job: job.name }, 'sending console mail');

      if (jobRun) {
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: { status: 'SUCCEEDED', finishedAt: new Date() },
        });
        if (tenantId && payload?.to) {
          await prisma.notification
            .create({
              data: {
                id: newId(),
                tenantId,
                recipientUserId: jobRun.actorUserId ?? 'system',
                type: job.name,
                deepLinkPath: '/app',
                dedupeKey: `${job.id}:${payload.to}`,
                sourceOutboxEventId: job.data.outboxId,
              },
            })
            .catch(() => undefined);
        }
      }
      return { ok: true };
    },
    { connection, concurrency: 2 },
  );
}
