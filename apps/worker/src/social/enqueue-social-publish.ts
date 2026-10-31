import { Queue } from 'bullmq';
import type IORedis from 'ioredis';
import {
  buildSocialPublishJobData,
  bullSocialJobId,
} from '../processors/social-job-payload';
import { getPrisma } from '@oma/db';
import { tokenKeyFromEnv } from '@oma/domain';
import { findDuePublishTargetIds } from './due-publish-targets';

export async function enqueueDueSocialPublishJobs(
  connection: IORedis,
  now = new Date(),
): Promise<number> {
  const key = tokenKeyFromEnv();
  const ids = await findDuePublishTargetIds(now, key);
  if (!ids.length) return 0;
  const prisma = getPrisma();
  const queue = new Queue('social', {
    connection,
    prefix: process.env.BULLMQ_PREFIX || 'oma',
  });
  let enqueued = 0;
  for (const publishTargetId of ids) {
    const target = await prisma.contentPublishTarget.findUnique({
      where: { id: publishTargetId },
      select: { tenantId: true, contentItemId: true, publishState: true },
    });
    if (!target || !['NONE', 'QUEUED'].includes(target.publishState)) continue;
    try {
      await queue.add(
        'social.publish',
        buildSocialPublishJobData({
          publishTargetId,
          tenantId: target.tenantId,
          contentItemId: target.contentItemId,
        }),
        {
          jobId: bullSocialJobId(publishTargetId),
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      enqueued++;
    } catch {
      // Duplicate job id — target already queued in BullMQ.
    }
  }
  return enqueued;
}
