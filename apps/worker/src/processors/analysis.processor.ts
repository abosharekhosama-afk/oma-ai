import { getPrisma } from '@oma/db';
import { AiProviderNotConfiguredError, refusingAiProvider, type AiProviderPort } from '@oma/domain';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';

export type AnalysisProcessorOptions = {
  ai?: AiProviderPort;
};

export function startAnalysisProcessor(
  connection: IORedis,
  options: AnalysisProcessorOptions = {},
) {
  const ai = options.ai ?? refusingAiProvider;

  return new Worker(
    'analysis',
    async (job) => {
      const data = job.data as { job_run_id?: string; scan_attempt_id?: string };
      const jobRunId = data.job_run_id;
      if (!jobRunId) throw new Error('missing job_run_id');

      const jobRun = await getPrisma().jobRun.findUnique({ where: { id: jobRunId } });
      if (!jobRun) throw new Error('job_run not found');
      if (jobRun.status === 'SUCCEEDED') return { ok: true, skipped: true };

      try {
        await ai.generate({
          tenantId: jobRun.tenantId ?? '',
          purpose: 'brand.analysis',
          inputSnapshotRefs: data.scan_attempt_id ? [data.scan_attempt_id] : [],
          prompt: 'brand intelligence analysis',
        });
      } catch (err) {
        if (err instanceof AiProviderNotConfiguredError) {
          if (data.scan_attempt_id) {
            await getPrisma().scanAttempt.updateMany({
              where: { id: data.scan_attempt_id },
              data: { aiAvailability: 'NOT_CONFIGURED' },
            });
          }
          await getPrisma().jobRun.update({
            where: { id: jobRunId },
            data: { status: 'SUCCEEDED', finishedAt: new Date() },
          });
          return { ok: true, skipped: true, ai_availability: 'NOT_CONFIGURED' };
        }
        throw err;
      }

      await getPrisma().jobRun.update({
        where: { id: jobRunId },
        data: { status: 'SUCCEEDED', finishedAt: new Date() },
      });
      return { ok: true };
    },
    { connection, prefix: process.env.BULLMQ_PREFIX || 'oma', concurrency: 1 },
  );
}
