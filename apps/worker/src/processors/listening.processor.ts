import { createLogger } from '@oma/observability';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { getPrisma } from '@oma/db';
import { runListeningPoll } from '../listening/meta-poll';

const log = createLogger('listening-processor');

type ListeningPollJob = { tenantId: string; ruleId: string };

export function startListeningProcessor(connection: IORedis) {
  const worker = new Worker<ListeningPollJob>(
    'listening',
    async (job: Job<ListeningPollJob>) => {
      const { tenantId, ruleId } = job.data;
      const rule = await getPrisma().listeningRule.findFirst({
        where: { id: ruleId, tenantId, isLive: true },
      });
      if (!rule) {
        log.info({ ruleId }, 'listening rule missing or paused');
        return;
      }
      const result = await runListeningPoll(ruleId);
      log.info({ ruleId, tenantId, ...result }, 'listening poll finished');
    },
    {
      connection,
      prefix: process.env.BULLMQ_PREFIX || 'oma',
      concurrency: 2,
    },
  );
  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: String(err) }, 'listening job failed');
  });
  return worker;
}

/** Schedule periodic poll of all live rules (called from main on interval). */
export async function tickListeningRules() {
  const rules = await getPrisma().listeningRule.findMany({
    where: { isLive: true },
    select: { id: true, tenantId: true },
    take: 200,
  });
  return rules;
}

