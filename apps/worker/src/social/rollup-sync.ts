import { getPrisma } from '@oma/db';
import { computePublishRollup, type TargetPublishState } from '@oma/domain';

/** Recompute ContentItem rollup + summary fields from its publish targets. */
export async function syncContentPublishRollup(contentItemId: string) {
  const prisma = getPrisma();
  const targets = await prisma.contentPublishTarget.findMany({
    where: { contentItemId },
    orderBy: { createdAt: 'asc' },
  });
  const rollup = computePublishRollup(
    targets.map((t) => t.publishState as TargetPublishState),
  );
  const published = targets.filter((t) => t.publishState === 'PUBLISHED');
  const failed = targets.filter((t) => t.publishState === 'FAILED');
  const retrying = targets.filter((t) => t.publishState === 'QUEUED' && t.nextPublishAt);
  const primary = published[0] ?? targets[0];
  const nextPublishAt = retrying.reduce<Date | null>((min, t) => {
    if (!t.nextPublishAt) return min;
    return !min || t.nextPublishAt < min ? t.nextPublishAt : min;
  }, null);

  await prisma.contentItem.update({
    where: { id: contentItemId },
    data: {
      publishState: rollup,
      socialPageId: targets[0]?.socialPageId ?? null,
      externalPostId: primary?.externalPostId ?? null,
      externalPostUrl: primary?.externalPostUrl ?? null,
      publishedAt:
        rollup === 'ALL_SUCCEEDED'
          ? (published[0]?.publishedAt ?? new Date())
          : published.length
            ? published[0]!.publishedAt
            : null,
      lastPublishError: failed[0]?.lastPublishError ?? null,
      nextPublishAt,
      publishAttempts: targets.reduce((m, t) => Math.max(m, t.publishAttempts), 0),
      workerPickedAt: targets.find((t) => t.workerPickedAt)?.workerPickedAt ?? null,
    },
  });
}
