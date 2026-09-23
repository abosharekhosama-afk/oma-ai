import { getPrisma } from '@oma/db';
import { AiProviderNotConfiguredError } from '@oma/domain';
import { OpenAiProviderAdapter } from '@oma/ai';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';

/** Text jobs only. Live OpenAI calls stay disabled until billing activation. */
export function startAiProcessor(connection: IORedis) {
  const adapter = new OpenAiProviderAdapter({
    liveEnabled: process.env.AI_LIVE_ENABLED === 'true',
    defaultModel: process.env.AI_DEFAULT_MODEL || 'gpt-5.6-luna',
    reasoningModel: process.env.AI_REASONING_MODEL || 'gpt-5.6-terra',
  });

  return new Worker(
    'ai',
    async (job) => {
      const runId = (job.data as { ai_run_id?: string }).ai_run_id;
      if (!runId) throw new Error('missing ai_run_id');
      const run = await getPrisma().aiRun.findUnique({ where: { id: runId } });
      if (!run) throw new Error('ai_run not found');
      if (run.status === 'CANCELLED' || run.status === 'SUCCEEDED')
        return { ok: true, skipped: true };
      try {
        await adapter.generate({
          tenantId: run.tenantId,
          purpose: run.useCase,
          inputSnapshotRefs: [run.sourceEntityId],
          prompt: run.useCase,
        });
      } catch (err) {
        if (
          err instanceof AiProviderNotConfiguredError ||
          (err as Error).name === 'BILLING_NOT_ENABLED'
        ) {
          await getPrisma().aiRun.update({
            where: { id: run.id },
            data: {
              status: 'DISABLED',
              errorCode:
                err instanceof AiProviderNotConfiguredError ? 'AI_DISABLED' : 'BILLING_NOT_ENABLED',
            },
          });
          return { ok: true, skipped: true, live: false };
        }
        throw err;
      }
      return { ok: false, code: 'MODEL_NOT_VERIFIED' };
    },
    {
      connection,
      prefix: process.env.BULLMQ_PREFIX || 'oma',
      concurrency: Number(process.env.AI_MAX_TENANT_CONCURRENCY || 2),
    },
  );
}
