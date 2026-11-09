import { getPrisma, upsertPostMetricSnapshot } from '@oma/db';
import {
  createSocialAdapter,
  fromSocialEnum,
  tokenKeyFromEnv,
  type SocialNetworkCode,
} from '@oma/domain';
import { pageForAdapter, type AdapterFactory } from './social-jobs';

const STALE_MS = () => Number(process.env.SOCIAL_INSIGHTS_INTERVAL_MS ?? 15 * 60_000);
const BATCH = 25;

export async function runInsightsTick(
  deps: {
    now?: () => Date;
    adapterFor?: AdapterFactory;
    key?: Buffer | null;
  } = {},
) {
  const now = deps.now?.() ?? new Date();
  const key = deps.key === undefined ? tokenKeyFromEnv() : deps.key;
  const adapterFor = deps.adapterFor ?? ((n: SocialNetworkCode) => createSocialAdapter(n));
  if (!key) return { checked: 0, updated: 0 };
  const staleBefore = new Date(now.getTime() - STALE_MS());
  const prisma = getPrisma();
  const targets = await prisma.contentPublishTarget.findMany({
    where: {
      publishState: 'PUBLISHED',
      externalPostId: { not: null },
      OR: [{ lastInsightsAt: null }, { lastInsightsAt: { lte: staleBefore } }],
    },
    include: { socialPage: true, contentItem: { select: { brandId: true, publishedAt: true } } },
    take: BATCH,
    orderBy: { lastInsightsAt: 'asc' },
  });
  let updated = 0;
  for (const target of targets) {
    const page = target.socialPage;
    if (!page || page.status !== 'CONNECTED' || !target.externalPostId) continue;
    try {
      const adapter = adapterFor(fromSocialEnum(page.network));
      if (!adapter.fetchInsights) {
        await prisma.contentPublishTarget.update({
          where: { id: target.id },
          data: { lastInsightsAt: now },
        });
        continue;
      }
      const insights = await adapter.fetchInsights(
        pageForAdapter(page, key),
        target.externalPostId,
      );
      const insightsJson = insights ? JSON.stringify(insights) : target.insightsJson;
      await prisma.contentPublishTarget.update({
        where: { id: target.id },
        data: {
          insightsJson,
          lastInsightsAt: now,
        },
      });
      if (insightsJson) {
        await upsertPostMetricSnapshot({
          tenantId: target.tenantId,
          brandId: target.contentItem?.brandId ?? target.socialPage?.brandId ?? '',
          socialPageId: target.socialPageId,
          publishTargetId: target.id,
          contentItemId: target.contentItemId,
          publishedAt: target.publishedAt ?? target.contentItem?.publishedAt,
          insightsJson,
          capturedAt: now,
        });
      }
      if (insights) updated += 1;
    } catch {
      await prisma.contentPublishTarget.update({
        where: { id: target.id },
        data: { lastInsightsAt: now },
      });
    }
  }
  return { checked: targets.length, updated };
}
