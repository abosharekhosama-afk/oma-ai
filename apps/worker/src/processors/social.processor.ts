import { createLogger } from '@oma/observability';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { publishOneTarget } from '../social/publish-one-target';
import type { SocialPublishJobPayload } from './social-job-payload';

const log = createLogger('social-processor');

export function startSocialProcessor(connection: IORedis) {
  const worker = new Worker<SocialPublishJobPayload>(
    'social',
    async (job: Job<SocialPublishJobPayload>) => {
      const { publishTargetId } = job.data;
      const result = await publishOneTarget(publishTargetId, { log });
      if (result.outcome === 'not_claimed') {
        log.info({ publishTargetId }, 'publish target already claimed');
      }
    },
    {
      connection,
      prefix: process.env.BULLMQ_PREFIX || 'oma',
      concurrency: Number(process.env.SOCIAL_PUBLISH_CONCURRENCY ?? 3),
    },
  );
  worker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: String(err) }, 'social publish job failed');
  });
  return worker;
}
