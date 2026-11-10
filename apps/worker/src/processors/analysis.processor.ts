import { getPrisma } from '@oma/db';
import { Worker } from 'bullmq';
import type IORedis from 'ioredis';
import { runBrandProfileAnalysis } from '../brand/brand-analysis.service';
import type { AnalysisJobPayload } from './analysis-job-payload';

export function startAnalysisProcessor(connection: IORedis) {
  return new Worker<AnalysisJobPayload>(
    'analysis',
    async (job) => {
      const data = job.data;
      const jobRunId = data.job_run_id;
      if (!jobRunId) throw new Error('missing job_run_id');

      const jobRun = await getPrisma().jobRun.findUnique({ where: { id: jobRunId } });
      if (!jobRun) throw new Error('job_run not found');
      if (jobRun.status === 'SUCCEEDED') return { ok: true, skipped: true };
      if (jobRun.status === 'DEAD' || jobRun.status === 'CANCELLED') {
        return { ok: true, skipped: true, status: jobRun.status };
      }

      if (data.tenant_id && jobRun.tenantId && data.tenant_id !== jobRun.tenantId) {
        await getPrisma().jobRun.update({
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

      const tenantId = jobRun.tenantId ?? data.tenant_id;
      if (!tenantId || !data.scan_attempt_id || !data.brand_id || !data.profile_version_id) {
        throw new Error('missing analysis fields');
      }

      await getPrisma().jobRun.update({
        where: { id: jobRun.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const result = await runBrandProfileAnalysis({
        tenantId,
        brandId: data.brand_id,
        scanAttemptId: data.scan_attempt_id,
        profileVersionId: data.profile_version_id,
        actorUserId: jobRun.actorUserId ?? data.actor_user_id ?? 'system',
        correlationId: jobRun.correlationId ?? data.correlation_id,
        idempotencyKey:
          jobRun.idempotencyKey ??
          data.idempotency_key ??
          `analysis:${data.scan_attempt_id}:${data.profile_version_id}`,
      });

      await getPrisma().jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: result.ok || result.skipped ? 'SUCCEEDED' : 'FAILED',
          errorCode:
            result.ok || result.skipped
              ? null
              : (result.errorCode ?? result.reason ?? 'ANALYSIS_FAILED'),
          finishedAt: new Date(),
        },
      });
      return result;
    },
    { connection, prefix: process.env.BULLMQ_PREFIX || 'oma', concurrency: 1 },
  );
}
