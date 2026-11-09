import { getPrisma, upsertPostMetricSnapshot } from '@oma/db';
import {
  createSocialAdapter,
  fromSocialEnum,
  tokenKeyFromEnv,
  type SocialNetworkCode,
} from '@oma/domain';
import { pageForAdapter } from './social-jobs';
import { recomputePageOptimalTimes } from './optimal-times';

/**
 * Historical post import (Stage 5)
 *
 * Supported adapters implement `listRecentPosts`:
 *   - facebook: Graph `{page-id}/published_posts`
 *   - instagram: Graph `{ig-user-id}/media`
 *   - x: `GET /2/users/:id/tweets`
 *   - tiktok: `POST /v2/video/list/`
 *   - linkedin: best-effort `GET /rest/posts?q=author` (returns [] without Community Management)
 *
 * Skipped:
 *   - whatsapp: Cloud API has no list-recent-posts endpoint (`listRecentPosts` is omitted).
 */

export const HISTORICAL_IMPORT_PAGES_PER_TICK = 3;
export const HISTORICAL_IMPORT_POSTS_PER_PAGE = 20;
export const HISTORICAL_IMPORT_INSIGHT_GAP_MS = 400;
export const HISTORICAL_IMPORT_MIN_AGE_MS = 20 * 60 * 60_000;

const META_KEY = 'optimalTimesImportAt';

function parseMeta(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function lastImportMs(metaJson: string): number {
  const raw = parseMeta(metaJson)[META_KEY];
  const n = typeof raw === 'string' || typeof raw === 'number' ? Date.parse(String(raw)) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runHistoricalImportTick(
  deps: {
    now?: () => Date;
    pagesPerTick?: number;
    postsPerPage?: number;
    insightGapMs?: number;
    minAgeMs?: number;
  } = {},
) {
  const now = deps.now?.() ?? new Date();
  const key = tokenKeyFromEnv(process.env);
  if (!key) return { skipped: 'no_token_key' as const, pages: 0, imported: 0, insights: 0 };

  const pagesPerTick = deps.pagesPerTick ?? HISTORICAL_IMPORT_PAGES_PER_TICK;
  const postsPerPage = deps.postsPerPage ?? HISTORICAL_IMPORT_POSTS_PER_PAGE;
  const insightGap = deps.insightGapMs ?? HISTORICAL_IMPORT_INSIGHT_GAP_MS;
  const minAge = deps.minAgeMs ?? HISTORICAL_IMPORT_MIN_AGE_MS;
  const prisma = getPrisma();
  const pages = await prisma.socialPage.findMany({
    where: { status: 'CONNECTED' },
    orderBy: { updatedAt: 'asc' },
    take: 40,
  });
  const due = pages
    .filter((p) => now.getTime() - lastImportMs(p.metaJson) >= minAge)
    .slice(0, pagesPerTick);

  let imported = 0;
  let insights = 0;
  for (const page of due) {
    const network = fromSocialEnum(page.network) as SocialNetworkCode;
    if (network === 'whatsapp') {
      await markImported(page.id, page.metaJson, now);
      continue;
    }
    const adapter = createSocialAdapter(network);
    if (!adapter.listRecentPosts) {
      await markImported(page.id, page.metaJson, now);
      continue;
    }
    let listed;
    try {
      listed = await adapter.listRecentPosts(pageForAdapter(page, key), { limit: postsPerPage });
    } catch {
      await markImported(page.id, page.metaJson, now);
      continue;
    }
    for (const post of listed) {
      let insight = post.insights ?? null;
      if (!insight && adapter.fetchInsights) {
        try {
          insight = await adapter.fetchInsights(pageForAdapter(page, key), post.externalPostId);
          if (insight) insights += 1;
        } catch {
          insight = null;
        }
        if (insightGap > 0) await sleep(insightGap);
      }
      const insightsJson = insight ? JSON.stringify(insight) : null;
      if (!insightsJson) continue;
      const ok = await upsertPostMetricSnapshot({
        tenantId: page.tenantId,
        brandId: page.brandId,
        socialPageId: page.id,
        externalPostId: post.externalPostId,
        publishedAt: post.publishedAt,
        insightsJson,
        source: 'historical_import',
        capturedAt: now,
      });
      if (ok) imported += 1;
    }
    await markImported(page.id, page.metaJson, now);
    if (imported > 0) {
      await recomputePageOptimalTimes(page.id, now).catch(() => null);
    }
  }
  return { pages: due.length, imported, insights, at: now.toISOString() };
}

async function markImported(pageId: string, previousMetaJson: string, now: Date) {
  const meta = parseMeta(previousMetaJson);
  meta[META_KEY] = now.toISOString();
  await getPrisma().socialPage.update({
    where: { id: pageId },
    data: { metaJson: JSON.stringify(meta) },
  });
}
