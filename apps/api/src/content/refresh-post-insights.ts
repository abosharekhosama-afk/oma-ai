import { getPrisma, upsertPostMetricSnapshot } from '@oma/db';
import {
  createSocialAdapter,
  decryptToken,
  fromSocialEnum,
  tokenKeyFromEnv,
  type SocialNetworkCode,
} from '@oma/domain';

const STALE_MS = 2 * 60 * 1000;

export type InsightsPage = {
  id: string;
  tenantId?: string;
  name: string;
  network: string;
  externalId: string;
  accessTokenEnc: string;
  refreshTokenEnc?: string | null;
  metaJson?: string;
  scopes: string[];
  status: string;
};

export type InsightsTarget = {
  id: string;
  tenantId?: string;
  socialPageId?: string;
  contentItemId?: string;
  publishedAt?: Date | null;
  externalPostId: string | null;
  insightsJson: string | null;
  lastInsightsAt: Date | null;
  socialPage: InsightsPage | null;
  contentItem?: { brandId?: string; publishedAt?: Date | null } | null;
};

/**
 * On-demand fetch of platform insights for a published target.
 * Skips when insights are fresh (unless `force`), there is no external post id,
 * the page is not connected, or the adapter cannot fetch insights.
 */
export async function maybeRefreshPublishTargetInsights(
  target: InsightsTarget | null | undefined,
  opts: { force?: boolean } = {},
): Promise<{ insightsJson: string | null; lastInsightsAt: Date | null } | null> {
  if (!target?.externalPostId) return null;
  const page = target.socialPage;
  if (!page || page.status !== 'CONNECTED') return null;

  const hasInsights = Boolean(target.insightsJson);
  const stale = !target.lastInsightsAt || Date.now() - target.lastInsightsAt.getTime() > STALE_MS;
  if (!opts.force && hasInsights && !stale) return null;

  const network = fromSocialEnum(page.network) as SocialNetworkCode;
  const adapter = createSocialAdapter(network, process.env);
  if (!adapter.fetchInsights) return null;

  const key = tokenKeyFromEnv();
  if (!key) return null;

  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(page.metaJson || '{}') as Record<string, unknown>;
  } catch {
    meta = {};
  }

  const prisma = getPrisma();
  try {
    const insights = await adapter.fetchInsights(
      {
        externalId: page.externalId,
        name: page.name,
        accessToken: decryptToken(page.accessTokenEnc, key),
        refreshToken: page.refreshTokenEnc ? decryptToken(page.refreshTokenEnc, key) : null,
        meta: { ...meta, scopes: page.scopes },
      },
      target.externalPostId,
    );
    const now = new Date();
    if (insights) {
      const insightsJson = JSON.stringify(insights);
      const updated = await prisma.contentPublishTarget.update({
        where: { id: target.id },
        data: {
          insightsJson,
          lastInsightsAt: now,
        },
      });
      const tenantId = target.tenantId ?? page.tenantId;
      const socialPageId = target.socialPageId ?? page.id;
      const contentItemId = target.contentItemId;
      if (tenantId && socialPageId && contentItemId) {
        let brandId = target.contentItem?.brandId ?? '';
        let publishedAt = target.publishedAt ?? target.contentItem?.publishedAt ?? null;
        if (!brandId || !publishedAt) {
          const item = await prisma.contentItem.findUnique({
            where: { id: contentItemId },
            select: { brandId: true, publishedAt: true },
          });
          brandId = brandId || item?.brandId || '';
          publishedAt = publishedAt ?? item?.publishedAt ?? null;
        }
        if (brandId) {
          await upsertPostMetricSnapshot({
            tenantId,
            brandId,
            socialPageId,
            publishTargetId: target.id,
            contentItemId,
            publishedAt,
            insightsJson,
            capturedAt: now,
          });
        }
      }
      return { insightsJson: updated.insightsJson, lastInsightsAt: updated.lastInsightsAt };
    }
    await prisma.contentPublishTarget.update({
      where: { id: target.id },
      data: { lastInsightsAt: now },
    });
    return { insightsJson: target.insightsJson, lastInsightsAt: now };
  } catch {
    try {
      await prisma.contentPublishTarget.update({
        where: { id: target.id },
        data: { lastInsightsAt: new Date() },
      });
    } catch {
      /* keep the previously loaded snapshot */
    }
    return null;
  }
}
