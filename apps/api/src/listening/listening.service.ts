import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import { classifySentiment } from '../inbox/sentiment';
import { enqueueListeningPoll } from '../inbox/enqueue-inbox';

export type ListHitsQuery = {
  ruleId?: string;
  brandId?: string;
  sentiment?: string;
  highPriorityOnly?: boolean;
  platforms?: string[];
  from?: string;
  to?: string;
  q?: string;
  sort?: 'relevance' | 'engagement' | 'recency';
  includeHidden?: boolean;
  includeExcluded?: boolean;
  page?: number;
  limit?: number;
};

function safeArr(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function hitWhere(tenantId: string, q: ListHitsQuery) {
  const from = parseDate(q.from);
  const to = parseDate(q.to);
  return tenantWhere(tenantId, {
    ...(q.ruleId ? { ruleId: q.ruleId } : {}),
    ...(q.brandId
      ? {
          OR: [{ rule: { brandId: q.brandId } }, { rule: { brandId: null } }],
        }
      : {}),
    ...(q.sentiment ? { sentiment: q.sentiment as never } : {}),
    ...(q.highPriorityOnly ? { isHighPriority: true } : {}),
    ...(q.platforms?.length ? { platform: { in: q.platforms as never[] } } : {}),
    ...(from || to
      ? {
          capturedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(!q.includeHidden ? { isHidden: false } : {}),
    ...(!q.includeExcluded ? { isExcluded: false } : {}),
    ...(q.q
      ? {
          OR: [
            { content: { contains: q.q, mode: 'insensitive' as const } },
            { authorName: { contains: q.q, mode: 'insensitive' as const } },
            { authorHandle: { contains: q.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  });
}

function mapHit(h: {
  id: string;
  ruleId: string | null;
  platform: string;
  externalPostId: string;
  authorName: string | null;
  authorHandle: string | null;
  authorAvatar: string | null;
  content: string;
  url: string | null;
  mediaUrlsJson: string | null;
  sentiment: string | null;
  isHighPriority: boolean;
  isHidden: boolean;
  isExcluded: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  sentimentLocked: boolean;
  matchedKeywordsJson: string;
  capturedAt: Date;
}) {
  return {
    id: h.id,
    ruleId: h.ruleId,
    platform: h.platform,
    externalPostId: h.externalPostId,
    authorName: h.authorName,
    authorHandle: h.authorHandle,
    authorAvatar: h.authorAvatar,
    content: h.content,
    url: h.url,
    mediaUrls: h.mediaUrlsJson ? safeArr(h.mediaUrlsJson) : [],
    sentiment: h.sentiment,
    isHighPriority: h.isHighPriority,
    isHidden: h.isHidden,
    isExcluded: h.isExcluded,
    likeCount: h.likeCount,
    commentCount: h.commentCount,
    shareCount: h.shareCount,
    sentimentLocked: h.sentimentLocked,
    matchedKeywords: safeArr(h.matchedKeywordsJson),
    capturedAt: h.capturedAt.toISOString(),
  };
}

function dayBuckets(
  hits: Array<{ capturedAt: Date; sentiment: string | null }>,
  from: Date,
  to: Date,
) {
  const out: Array<{
    key: string;
    label: string;
    positive: number;
    neutral: number;
    negative: number;
    total: number;
  }> = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur.getTime() <= end.getTime()) {
    const next = new Date(cur);
    next.setDate(next.getDate() + 1);
    const dayHits = hits.filter((h) => {
      const t = h.capturedAt.getTime();
      return t >= cur.getTime() && t < next.getTime();
    });
    out.push({
      key: cur.toISOString().slice(0, 10),
      label: cur.toLocaleDateString(undefined, { weekday: 'short' }),
      positive: dayHits.filter((h) => h.sentiment === 'POSITIVE').length,
      neutral: dayHits.filter((h) => h.sentiment === 'NEUTRAL').length,
      negative: dayHits.filter((h) => h.sentiment === 'NEGATIVE').length,
      total: dayHits.length,
    });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function trendPct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export class ListeningService {
  async listRules(tenantId: string, brandId?: string) {
    const rows = await getPrisma().listeningRule.findMany({
      where: tenantWhere(tenantId, brandId ? { OR: [{ brandId }, { brandId: null }] } : {}),
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        workspaceId: r.workspaceId,
        brandId: r.brandId,
        keywords: safeArr(r.keywordsJson),
        hashtags: safeArr(r.hashtagsJson),
        platforms: safeArr(r.platformsJson),
        isLive: r.isLive,
        contextJson: r.contextJson,
        lastPollAt: r.lastPollAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async createRule(
    tenantId: string,
    body: {
      name?: string;
      workspaceId?: string;
      brandId?: string | null;
      keywords?: string[];
      hashtags?: string[];
      platforms?: string[];
      isLive?: boolean;
    },
  ) {
    const name = (body.name ?? '').trim();
    if (!name)
      throw new DomainError('VALIDATION_FAILED', 'name required', 400, 'errors.validation');
    const workspaceId = body.workspaceId?.trim() || tenantId;
    const id = newId();
    const row = await getPrisma().listeningRule.create({
      data: {
        id,
        tenantId,
        workspaceId,
        brandId: body.brandId ?? null,
        name,
        keywordsJson: JSON.stringify(body.keywords ?? []),
        hashtagsJson: JSON.stringify(body.hashtags ?? []),
        platformsJson: JSON.stringify(body.platforms ?? []),
        isLive: body.isLive !== false,
      },
    });
    if (row.isLive) {
      await enqueueListeningPoll({ tenantId, ruleId: row.id });
    }
    return { id: row.id };
  }

  async updateRule(
    tenantId: string,
    id: string,
    body: {
      name?: string;
      keywords?: string[];
      hashtags?: string[];
      platforms?: string[];
      isLive?: boolean;
      contextJson?: string | null;
    },
  ) {
    const existing = await getPrisma().listeningRule.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!existing) throw new DomainError('NOT_FOUND', 'Rule not found', 404, 'errors.not_found');
    const row = await getPrisma().listeningRule.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.keywords ? { keywordsJson: JSON.stringify(body.keywords) } : {}),
        ...(body.hashtags ? { hashtagsJson: JSON.stringify(body.hashtags) } : {}),
        ...(body.platforms ? { platformsJson: JSON.stringify(body.platforms) } : {}),
        ...(body.isLive !== undefined ? { isLive: body.isLive } : {}),
        ...(body.contextJson !== undefined ? { contextJson: body.contextJson } : {}),
      },
    });
    return { id: row.id, isLive: row.isLive };
  }

  async deleteRule(tenantId: string, id: string) {
    const existing = await getPrisma().listeningRule.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!existing) throw new DomainError('NOT_FOUND', 'Rule not found', 404, 'errors.not_found');
    await getPrisma().listeningRule.delete({ where: { id } });
    return { ok: true };
  }

  async listHits(tenantId: string, q: ListHitsQuery) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(200, Math.max(1, q.limit ?? 40));
    const where = hitWhere(tenantId, q);
    const orderBy =
      q.sort === 'engagement'
        ? [
            { likeCount: 'desc' as const },
            { commentCount: 'desc' as const },
            { capturedAt: 'desc' as const },
          ]
        : q.sort === 'recency'
          ? [{ capturedAt: 'desc' as const }]
          : [{ isHighPriority: 'desc' as const }, { capturedAt: 'desc' as const }];

    const [total, rows] = await Promise.all([
      getPrisma().listeningHit.count({ where }),
      getPrisma().listeningHit.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { page, limit, total, items: rows.map(mapHit) };
  }

  async stats(
    tenantId: string,
    q: { ruleId?: string; brandId?: string; from?: string; to?: string; platforms?: string[] },
  ) {
    const to = parseDate(q.to) ?? new Date();
    const from = parseDate(q.from) ?? new Date(to.getTime() - 6 * 86400_000);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const spanMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - spanMs);

    const base = hitWhere(tenantId, {
      ruleId: q.ruleId,
      brandId: q.brandId,
      platforms: q.platforms,
      includeHidden: false,
      includeExcluded: false,
    });

    const [current, previous, rules] = await Promise.all([
      getPrisma().listeningHit.findMany({
        where: { ...base, capturedAt: { gte: from, lte: to } },
        select: {
          capturedAt: true,
          sentiment: true,
          likeCount: true,
          commentCount: true,
          shareCount: true,
        },
      }),
      getPrisma().listeningHit.findMany({
        where: { ...base, capturedAt: { gte: prevFrom, lte: prevTo } },
        select: { likeCount: true, commentCount: true, shareCount: true },
      }),
      getPrisma().listeningRule.findMany({
        where: tenantWhere(tenantId, {
          ...(q.brandId ? { OR: [{ brandId: q.brandId }, { brandId: null }] } : {}),
          ...(q.ruleId ? { id: q.ruleId } : {}),
        }),
        select: { lastPollAt: true },
        orderBy: { lastPollAt: 'desc' },
        take: 1,
      }),
    ]);

    const mentions = current.length;
    const prevMentions = await getPrisma().listeningHit.count({
      where: { ...base, capturedAt: { gte: prevFrom, lte: prevTo } },
    });
    const engagement = current.reduce((s, h) => s + h.likeCount + h.commentCount + h.shareCount, 0);
    const prevEngagement = previous.reduce(
      (s, h) => s + h.likeCount + h.commentCount + h.shareCount,
      0,
    );
    const positive = current.filter((h) => h.sentiment === 'POSITIVE').length;
    const neutral = current.filter((h) => h.sentiment === 'NEUTRAL').length;
    const negative = current.filter((h) => h.sentiment === 'NEGATIVE').length;

    const lastPollAt = rules[0]?.lastPollAt ?? null;
    const pollIntervalMs = 5 * 60 * 1000;
    const nextPollAt = lastPollAt
      ? new Date(lastPollAt.getTime() + pollIntervalMs)
      : new Date(Date.now() + pollIntervalMs);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      mentions,
      mentionsTrendPct: trendPct(mentions, prevMentions),
      engagement,
      engagementTrendPct: trendPct(engagement, prevEngagement),
      sentiment: { positive, neutral, negative, total: positive + neutral + negative },
      volume: dayBuckets(current, from, to),
      lastPollAt: lastPollAt?.toISOString() ?? null,
      nextPollAt: nextPollAt.toISOString(),
    };
  }

  async requestSync(tenantId: string, body: { ruleId?: string; brandId?: string | null }) {
    const rules = await getPrisma().listeningRule.findMany({
      where: tenantWhere(tenantId, {
        isLive: true,
        ...(body.ruleId ? { id: body.ruleId } : {}),
        ...(body.brandId ? { brandId: body.brandId } : {}),
      }),
      select: { id: true },
    });
    if (!rules.length) {
      throw new DomainError('NOT_FOUND', 'No live listening rules', 404, 'errors.not_found');
    }
    let queued = 0;
    for (const r of rules) {
      const ok = await enqueueListeningPoll({ tenantId, ruleId: r.id });
      if (ok) queued += 1;
    }
    return { queued, rules: rules.length };
  }

  async updateHit(
    tenantId: string,
    id: string,
    body: {
      sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
      isHidden?: boolean;
      isExcluded?: boolean;
    },
  ) {
    const hit = await getPrisma().listeningHit.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!hit) throw new DomainError('NOT_FOUND', 'Hit not found', 404, 'errors.not_found');
    const updated = await getPrisma().listeningHit.update({
      where: { id },
      data: {
        ...(body.sentiment
          ? {
              sentiment: body.sentiment,
              sentimentLocked: true,
              isHighPriority: body.sentiment === 'NEGATIVE',
            }
          : {}),
        ...(body.isHidden !== undefined ? { isHidden: body.isHidden } : {}),
        ...(body.isExcluded !== undefined ? { isExcluded: body.isExcluded } : {}),
      },
    });
    return mapHit(updated);
  }

  /** Called by worker when a public mention is captured. */
  async recordHit(input: {
    tenantId: string;
    ruleId?: string | null;
    platform: 'META_FB' | 'META_IG' | 'TIKTOK' | 'LINKEDIN';
    externalPostId: string;
    authorName?: string | null;
    authorHandle?: string | null;
    authorAvatar?: string | null;
    content: string;
    url?: string | null;
    mediaUrls?: string[];
    matchedKeywords?: string[];
    likeCount?: number;
    commentCount?: number;
    shareCount?: number;
  }) {
    const sentiment = classifySentiment(input.content);
    const isHighPriority = sentiment === 'NEGATIVE';
    const existing = await getPrisma().listeningHit.findUnique({
      where: {
        tenantId_platform_externalPostId: {
          tenantId: input.tenantId,
          platform: input.platform,
          externalPostId: input.externalPostId,
        },
      },
    });
    if (existing) {
      const updated = await getPrisma().listeningHit.update({
        where: { id: existing.id },
        data: {
          likeCount: input.likeCount ?? existing.likeCount,
          commentCount: input.commentCount ?? existing.commentCount,
          shareCount: input.shareCount ?? existing.shareCount,
          ...(existing.sentimentLocked
            ? {}
            : { sentiment, isHighPriority: existing.isHighPriority || isHighPriority }),
        },
      });
      return { id: updated.id, duplicate: true };
    }

    const id = newId();
    await getPrisma().listeningHit.create({
      data: {
        id,
        tenantId: input.tenantId,
        ruleId: input.ruleId ?? null,
        platform: input.platform,
        externalPostId: input.externalPostId,
        authorName: input.authorName ?? null,
        authorHandle: input.authorHandle ?? null,
        authorAvatar: input.authorAvatar ?? null,
        content: input.content,
        url: input.url ?? null,
        mediaUrlsJson: input.mediaUrls?.length ? JSON.stringify(input.mediaUrls) : null,
        sentiment,
        isHighPriority,
        likeCount: input.likeCount ?? 0,
        commentCount: input.commentCount ?? 0,
        shareCount: input.shareCount ?? 0,
        matchedKeywordsJson: JSON.stringify(input.matchedKeywords ?? []),
      },
    });
    return { id, duplicate: false, sentiment, isHighPriority };
  }
}

export const listeningService = new ListeningService();
