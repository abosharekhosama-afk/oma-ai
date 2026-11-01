import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { getPrisma } from '@oma/db';

function bullSocialJobId(publishTargetId: string) {
  return `social-publish-${publishTargetId.replace(/:/g, '_')}`;
}

/** Best-effort: enqueue BullMQ social.publish jobs for QUEUED targets (same as worker). */
export async function enqueuePublishTargetsNow(contentItemId: string): Promise<number> {
  const url = process.env.REDIS_URL;
  if (!url) return 0;
  const targets = await getPrisma().contentPublishTarget.findMany({
    where: { contentItemId, publishState: { in: ['NONE', 'QUEUED'] } },
    select: { id: true, tenantId: true, contentItemId: true, publishState: true },
  });
  if (!targets.length) return 0;
  const connection = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const queue = new Queue('social', {
    connection,
    prefix: process.env.BULLMQ_PREFIX || 'oma',
  });
  let n = 0;
  try {
    for (const t of targets) {
      try {
        await queue.add(
          'social.publish',
          {
            publishTargetId: t.id,
            tenantId: t.tenantId,
            contentItemId: t.contentItemId,
          },
          {
            jobId: bullSocialJobId(t.id),
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        n += 1;
      } catch {
        // duplicate job id
      }
    }
  } finally {
    await queue.close().catch(() => undefined);
    connection.disconnect();
  }
  return n;
}
