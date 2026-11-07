import { getPrisma, tenantWhere } from '@oma/db';
import {
  buildListeningSourceCatalog,
  DomainError,
  ListeningRuleValidationError,
  mergedTermsAreUseful,
  newId,
  validateListeningRuleWrite,
} from '@oma/domain';
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

type RuleKind = 'BRAND' | 'COMPETITOR' | 'TOPIC';

function resolveRuleKind(row: { kind: string; name: string }): RuleKind {
  const k = String(row.kind || '').toUpperCase();
  if (k === 'COMPETITOR' || k === 'TOPIC') return k;
  if (/competitor/i.test(row.name)) return 'COMPETITOR';
  if (/topic|hashtag/i.test(row.name)) return 'TOPIC';
  return 'BRAND';
}

function platformLabel(code: string): string {
  const m: Record<string, string> = {
    META_FB: 'Facebook',
    META_IG: 'Instagram',
    TIKTOK: 'TikTok',
    LINKEDIN: 'LinkedIn',
    X: 'X',
    WHATSAPP: 'WhatsApp',
    REDDIT: 'Reddit',
    WEB: 'Web',
    YOUTUBE: 'YouTube',
  };
  return m[code] ?? code;
}

function parseThresholdJson(json: string): Record<string, number> {
  try {
    const v = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, raw] of Object.entries(v)) {
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (Number.isFinite(n)) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

function alertFiresWhen(triggerType: string, threshold: Record<string, number>): string {
  if (triggerType === 'VOLUME_SPIKE') {
    const n = threshold.mentionsPerDay;
    return n ? `Over ${n} mentions / day` : 'More mentions than usual';
  }
  if (triggerType === 'SENTIMENT_POSITIVE') {
    return `Over ${threshold.sharePct ?? 0}% positive / day`;
  }
  if (triggerType === 'SENTIMENT_NEGATIVE') {
    return `Over ${threshold.sharePct ?? 0}% negative / day`;
  }
  return triggerType;
}

function brandHitScope(brandId: string | null) {
  return {
    isHidden: false,
    isExcluded: false,
    rule: {
      kind: 'BRAND',
      isLive: true,
      ...(brandId ? { OR: [{ brandId }, { brandId: null }] } : {}),
    },
  };
}

function netSentimentBalance(positive: number, neutral: number, negative: number): number {
  const total = positive + neutral + negative;
  if (!total) return 0;
  return Math.round(((positive - negative) / total) * 100);
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
        kind: resolveRuleKind(r),
        workspaceId: r.workspaceId,
        brandId: r.brandId,
        keywords: safeArr(r.keywordsJson),
        hashtags: safeArr(r.hashtagsJson),
        platforms: safeArr(r.platformsJson),
        isLive: r.isLive,
        contextJson: r.contextJson,
        lastPollAt: r.lastPollAt?.toISOString() ?? null,
        syncStatus: r.syncStatus,
        lastSyncStartedAt: r.lastSyncStartedAt?.toISOString() ?? null,
        lastSyncFinishedAt: r.lastSyncFinishedAt?.toISOString() ?? null,
        lastSyncIngested: r.lastSyncIngested,
        lastSyncError: r.lastSyncError,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }

  async createRule(tenantId: string, body: Record<string, unknown>) {
    const input = this.parseWrite(body, 'create');
    const brandId = await this.assertBrand(tenantId, input.brandId ?? null);
    const id = newId();
    const row = await getPrisma().listeningRule.create({
      data: {
        id,
        tenantId,
        workspaceId: tenantId,
        brandId,
        name: input.name!,
        kind: input.kind!,
        keywordsJson: JSON.stringify(input.keywords ?? []),
        hashtagsJson: JSON.stringify(input.hashtags ?? []),
        platformsJson: JSON.stringify(input.platforms ?? []),
        isLive: input.isLive !== false,
        contextJson: input.contextJson ?? null,
        syncStatus: 'IDLE',
      },
    });
    const queued = row.isLive ? await this.queueRule(tenantId, row.id) : null;
    return { id: row.id, sync: queued };
  }

  async updateRule(tenantId: string, id: string, body: Record<string, unknown>) {
    const existing = await getPrisma().listeningRule.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!existing) throw new DomainError('NOT_FOUND', 'Rule not found', 404, 'errors.not_found');
    const input = this.parseWrite(body, 'update');
    const keywords = input.keywords ?? safeArr(existing.keywordsJson);
    const hashtags = input.hashtags ?? safeArr(existing.hashtagsJson);
    if (!mergedTermsAreUseful(keywords, hashtags)) {
      throw new DomainError('VALIDATION_FAILED', 'terms required', 400, 'errors.validation');
    }
    if (input.platforms && input.platforms.length === 0) {
      throw new DomainError('VALIDATION_FAILED', 'platforms required', 400, 'errors.validation');
    }
    const brandId =
      input.brandId !== undefined ? await this.assertBrand(tenantId, input.brandId) : undefined;
    const row = await getPrisma().listeningRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.keywords ? { keywordsJson: JSON.stringify(input.keywords) } : {}),
        ...(input.hashtags ? { hashtagsJson: JSON.stringify(input.hashtags) } : {}),
        ...(input.platforms ? { platformsJson: JSON.stringify(input.platforms) } : {}),
        ...(input.isLive !== undefined ? { isLive: input.isLive } : {}),
        ...(input.contextJson !== undefined ? { contextJson: input.contextJson } : {}),
        ...(brandId !== undefined ? { brandId } : {}),
      },
    });
    const becameActive = row.isLive && (input.isLive === true || existing.isLive);
    const termsChanged = Boolean(input.keywords || input.hashtags || input.platforms);
    const queued =
      row.isLive && (input.isLive === true || (existing.isLive && termsChanged))
        ? await this.queueRule(tenantId, row.id)
        : null;
    return {
      id: row.id,
      isLive: row.isLive,
      sync: queued,
      resumed: becameActive && !existing.isLive,
    };
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

    const rule = rules[0];
    const lastPollAt = rule?.lastPollAt ?? null;

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
      sync: rule
        ? {
            ruleId: rule.id,
            isLive: rule.isLive,
            status: rule.syncStatus,
            lastSyncStartedAt: rule.lastSyncStartedAt?.toISOString() ?? null,
            lastSyncFinishedAt: rule.lastSyncFinishedAt?.toISOString() ?? null,
            lastSyncIngested: rule.lastSyncIngested,
            lastSyncError: rule.lastSyncError,
          }
        : null,
    };
  }

  /** Multi-brand compare: share of voice, sentiment, and source split from live ListeningHit rows. */
  async competitorDashboard(
    tenantId: string,
    q: { brandId?: string; from?: string; to?: string; platforms?: string[] },
  ) {
    const to = parseDate(q.to) ?? new Date();
    const from = parseDate(q.from) ?? new Date(to.getTime() - 6 * 86400_000);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const spanMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - spanMs);

    const rules = await getPrisma().listeningRule.findMany({
      where: tenantWhere(tenantId, {
        ...(q.brandId ? { OR: [{ brandId: q.brandId }, { brandId: null }] } : {}),
      }),
      orderBy: { createdAt: 'asc' },
    });
    const brandRules = rules.filter((r) => resolveRuleKind(r) === 'BRAND');
    const competitorRules = rules.filter((r) => resolveRuleKind(r) === 'COMPETITOR');
    const track = [...brandRules, ...competitorRules];
    if (!track.length) {
      return {
        from: from.toISOString(),
        to: to.toISOString(),
        totals: { mentions: 0 },
        entities: [],
        bySource: [],
        quadrant: [],
      };
    }

    const platformFilter = q.platforms?.length ? { platform: { in: q.platforms as never[] } } : {};

    const entityRows = await Promise.all(
      track.map(async (rule) => {
        const base = {
          tenantId,
          ruleId: rule.id,
          isHidden: false,
          isExcluded: false,
          ...platformFilter,
        };
        const [current, previous] = await Promise.all([
          getPrisma().listeningHit.findMany({
            where: { ...base, capturedAt: { gte: from, lte: to } },
            select: {
              capturedAt: true,
              sentiment: true,
              platform: true,
              likeCount: true,
              commentCount: true,
              shareCount: true,
            },
          }),
          getPrisma().listeningHit.findMany({
            where: { ...base, capturedAt: { gte: prevFrom, lte: prevTo } },
            select: { id: true },
          }),
        ]);
        const mentions = current.length;
        const prevMentions = previous.length;
        const engagement = current.reduce(
          (s, h) => s + h.likeCount + h.commentCount + h.shareCount,
          0,
        );
        const positive = current.filter((h) => h.sentiment === 'POSITIVE').length;
        const neutral = current.filter((h) => h.sentiment === 'NEUTRAL').length;
        const negative = current.filter((h) => h.sentiment === 'NEGATIVE').length;
        const volume = dayBuckets(current, from, to).map((d) => d.total);
        return {
          ruleId: rule.id,
          name: rule.name,
          kind: resolveRuleKind(rule),
          isYou: resolveRuleKind(rule) === 'BRAND',
          mentions,
          mentionsTrendPct: trendPct(mentions, prevMentions),
          engagement,
          engagementTrendPct: null as number | null,
          sentiment: {
            positive,
            neutral,
            negative,
            balance: netSentimentBalance(positive, neutral, negative),
          },
          sparkline: volume,
          hits: current,
          prevMentions,
        };
      }),
    );

    const totalMentions = entityRows.reduce((s, e) => s + e.mentions, 0);
    const prevTotal = entityRows.reduce((s, e) => s + e.prevMentions, 0);
    const youRuleId = brandRules[0]?.id ?? null;

    const entities = entityRows.map((e) => {
      const sharePct = totalMentions ? Math.round((e.mentions / totalMentions) * 1000) / 10 : 0;
      const prevShare = prevTotal ? (e.prevMentions / prevTotal) * 100 : 0;
      const shareChangePts = Math.round((sharePct - prevShare) * 10) / 10;
      const { hits: _hits, prevMentions: _p, ...rest } = e;
      return { ...rest, sharePct, shareChangePts };
    });

    const platformMap = new Map<string, { mentions: number; byRule: Map<string, number> }>();
    for (const e of entityRows) {
      for (const h of e.hits) {
        const plat = String(h.platform);
        let row = platformMap.get(plat);
        if (!row) {
          row = { mentions: 0, byRule: new Map() };
          platformMap.set(plat, row);
        }
        row.mentions += 1;
        row.byRule.set(e.ruleId, (row.byRule.get(e.ruleId) ?? 0) + 1);
      }
    }
    const bySource = [...platformMap.entries()]
      .map(([platform, row]) => {
        const splits = track.map((rule) => ({
          ruleId: rule.id,
          name: rule.name,
          mentions: row.byRule.get(rule.id) ?? 0,
          isYou: resolveRuleKind(rule) === 'BRAND',
        }));
        const yourMentions = youRuleId ? (row.byRule.get(youRuleId) ?? 0) : 0;
        const yourSharePct = row.mentions
          ? Math.round((yourMentions / row.mentions) * 1000) / 10
          : 0;
        return {
          platform,
          label: platformLabel(platform),
          mentions: row.mentions,
          splits,
          yourSharePct,
        };
      })
      .sort((a, b) => b.mentions - a.mentions);

    const mentionValues = entityRows.map((e) => e.mentions);
    const medianMentions =
      mentionValues.length && mentionValues.some((n) => n > 0)
        ? mentionValues.sort((a, b) => a - b)[Math.floor(mentionValues.length / 2)]!
        : 0;
    const quadrant = entityRows.map((e) => ({
      ruleId: e.ruleId,
      name: e.name,
      isYou: e.isYou,
      mentions: e.mentions,
      balance: e.sentiment.balance,
      bucket:
        e.mentions >= medianMentions && e.sentiment.balance >= 0
          ? 'leading'
          : e.mentions >= medianMentions && e.sentiment.balance < 0
            ? 'under_fire'
            : e.mentions < medianMentions && e.sentiment.balance >= 0
              ? 'well_liked'
              : 'quiet',
    }));

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: { mentions: totalMentions, previousMentions: prevTotal },
      entities,
      bySource,
      quadrant,
    };
  }

  async listAlerts(tenantId: string, brandId?: string) {
    const rows = await getPrisma().listeningAlert.findMany({
      where: tenantWhere(tenantId, brandId ? { brandId } : {}),
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: rows.map((a) => {
        const threshold = parseThresholdJson(a.thresholdJson);
        const platforms = safeArr(a.platformsJson);
        return {
          id: a.id,
          name: a.name,
          brandId: a.brandId,
          triggerType: a.triggerType,
          threshold,
          platforms,
          platformsLabel: platforms.length ? platforms.join(', ') : 'All platforms',
          firesWhen: alertFiresWhen(a.triggerType, threshold),
          notifyInApp: a.notifyInApp,
          notifyEmail: a.notifyEmail,
          notifySlack: a.notifySlack,
          isActive: a.isActive,
          lastFiredAt: a.lastFiredAt?.toISOString() ?? null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        };
      }),
    };
  }

  async createAlert(
    tenantId: string,
    body: {
      name?: string;
      brandId?: string | null;
      triggerType?: string;
      threshold?: Record<string, number>;
      platforms?: string[];
      notifyInApp?: boolean;
      notifyEmail?: boolean;
      notifySlack?: boolean;
      isActive?: boolean;
    },
  ) {
    const name = (body.name ?? '').trim();
    if (!name)
      throw new DomainError('VALIDATION_FAILED', 'name required', 400, 'errors.validation');
    const triggerType = String(body.triggerType || 'VOLUME_SPIKE').toUpperCase();
    const id = newId();
    await getPrisma().listeningAlert.create({
      data: {
        id,
        tenantId,
        brandId: body.brandId ?? null,
        name,
        triggerType,
        thresholdJson: JSON.stringify(body.threshold ?? {}),
        platformsJson: JSON.stringify(body.platforms ?? []),
        notifyInApp: body.notifyInApp !== false,
        notifyEmail: Boolean(body.notifyEmail),
        notifySlack: Boolean(body.notifySlack),
        isActive: body.isActive !== false,
      },
    });
    return { id };
  }

  async updateAlert(
    tenantId: string,
    id: string,
    body: {
      name?: string;
      triggerType?: string;
      threshold?: Record<string, number>;
      platforms?: string[];
      notifyInApp?: boolean;
      notifyEmail?: boolean;
      notifySlack?: boolean;
      isActive?: boolean;
    },
  ) {
    const existing = await getPrisma().listeningAlert.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!existing) throw new DomainError('NOT_FOUND', 'Alert not found', 404, 'errors.not_found');
    await getPrisma().listeningAlert.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.triggerType ? { triggerType: body.triggerType.toUpperCase() } : {}),
        ...(body.threshold ? { thresholdJson: JSON.stringify(body.threshold) } : {}),
        ...(body.platforms ? { platformsJson: JSON.stringify(body.platforms) } : {}),
        ...(body.notifyInApp !== undefined ? { notifyInApp: body.notifyInApp } : {}),
        ...(body.notifyEmail !== undefined ? { notifyEmail: body.notifyEmail } : {}),
        ...(body.notifySlack !== undefined ? { notifySlack: body.notifySlack } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
    return { id };
  }

  async deleteAlert(tenantId: string, id: string) {
    const existing = await getPrisma().listeningAlert.findFirst({
      where: tenantWhere(tenantId, { id }),
    });
    if (!existing) throw new DomainError('NOT_FOUND', 'Alert not found', 404, 'errors.not_found');
    await getPrisma().listeningAlert.delete({ where: { id } });
    return { ok: true };
  }

  /** Evaluate active alerts for a calendar day (yesterday UTC). Called from the worker cron. */
  async evaluateAlertsForDay(tenantId: string, day: Date) {
    const start = new Date(day);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const alerts = await getPrisma().listeningAlert.findMany({
      where: tenantWhere(tenantId, { isActive: true }),
    });
    if (!alerts.length) return { evaluated: 0, fired: 0 };

    let fired = 0;

    for (const alert of alerts) {
      const platforms = safeArr(alert.platformsJson);
      const dayHits = await getPrisma().listeningHit.findMany({
        where: tenantWhere(tenantId, {
          ...brandHitScope(alert.brandId),
          ...(platforms.length ? { platform: { in: platforms as never[] } } : {}),
          capturedAt: { gte: start, lt: end },
        }),
        select: { sentiment: true },
      });
      const total = dayHits.length;
      const threshold = parseThresholdJson(alert.thresholdJson);
      let shouldFire = false;
      if (alert.triggerType === 'VOLUME_SPIKE') {
        const min = threshold.mentionsPerDay ?? 0;
        if (min > 0 && total >= min) shouldFire = true;
        else if (!min && total > 0) {
          const histFrom = new Date(start.getTime() - 7 * 86400_000);
          const hist = await getPrisma().listeningHit.count({
            where: tenantWhere(tenantId, {
              ...brandHitScope(alert.brandId),
              capturedAt: { gte: histFrom, lt: start },
            }),
          });
          const avg = hist / 7;
          if (avg > 0 && total > avg * 1.2) shouldFire = true;
        }
      } else if (alert.triggerType === 'SENTIMENT_POSITIVE' && total > 0) {
        const pct = (dayHits.filter((h) => h.sentiment === 'POSITIVE').length / total) * 100;
        if (pct >= (threshold.sharePct ?? 0)) shouldFire = true;
      } else if (alert.triggerType === 'SENTIMENT_NEGATIVE' && total > 0) {
        const pct = (dayHits.filter((h) => h.sentiment === 'NEGATIVE').length / total) * 100;
        if (pct >= (threshold.sharePct ?? 0)) shouldFire = true;
      }
      if (shouldFire) {
        fired += 1;
        await getPrisma().listeningAlert.update({
          where: { id: alert.id },
          data: { lastFiredAt: end },
        });
        if (alert.notifyInApp) {
          const readers = await getPrisma().membership.findMany({
            where: {
              tenantId,
              status: 'ACTIVE',
              grants: { some: { revokedAt: null, capabilityCode: 'content.read' } },
            },
            select: { userId: true },
          });
          const dayKey = start.toISOString().slice(0, 10);
          const rows = readers
            .map((r) => r.userId)
            .filter(Boolean)
            .map((uid) => ({
              id: newId(),
              tenantId,
              recipientUserId: uid!,
              type: 'listening.alert_fired',
              objectType: 'ListeningAlert',
              objectId: alert.id,
              deepLinkPath: '/app/listening/alerts',
              dedupeKey: `listening.alert:${alert.id}:${uid}:${dayKey}`,
            }));
          if (rows.length) {
            await getPrisma().notification.createMany({ data: rows, skipDuplicates: true });
          }
        }
      }
    }
    return { evaluated: alerts.length, fired };
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
    const items = [];
    let queued = 0;
    for (const r of rules) {
      const sync = await this.queueRule(tenantId, r.id);
      if (sync.status === 'QUEUED' && !sync.alreadyQueued) queued += 1;
      items.push({ id: r.id, ...sync });
    }
    return {
      queued,
      rules: rules.length,
      status: queued > 0 ? 'queued' : (items[0]?.status ?? 'not_queued'),
      items,
    };
  }

  async sourceReadiness(tenantId: string, brandId?: string) {
    const scopedBrand = brandId ? await this.assertBrand(tenantId, brandId) : null;
    const pages = await getPrisma().socialPage.findMany({
      where: tenantWhere(tenantId, {
        status: 'CONNECTED',
        ...(scopedBrand ? { brandId: scopedBrand } : {}),
      }),
      select: { network: true },
    });
    return {
      sources: buildListeningSourceCatalog({
        connectedNetworks: pages.map((page) => page.network),
        youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
        webConfigured: Boolean(
          process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim(),
        ),
      }),
      channelsPath: scopedBrand
        ? `/app/brands/${scopedBrand}/settings?tab=accounts`
        : '/app/brands',
    };
  }

  private parseWrite(body: Record<string, unknown>, mode: 'create' | 'update') {
    try {
      return validateListeningRuleWrite(body, mode);
    } catch (error) {
      if (error instanceof ListeningRuleValidationError) {
        throw new DomainError('VALIDATION_FAILED', error.field, 400, 'errors.validation');
      }
      throw error;
    }
  }

  private async assertBrand(tenantId: string, brandId: string | null): Promise<string | null> {
    if (!brandId) return null;
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
      select: { id: true },
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
    return brand.id;
  }

  private async queueRule(tenantId: string, ruleId: string) {
    const ok = await enqueueListeningPoll({ tenantId, ruleId });
    if (ok) {
      await getPrisma().listeningRule.update({
        where: { id: ruleId },
        data: { syncStatus: 'QUEUED', lastSyncError: null },
      });
      return { status: 'QUEUED' as const, alreadyQueued: false };
    }
    const current = await getPrisma().listeningRule.findFirst({
      where: tenantWhere(tenantId, { id: ruleId }),
      select: { syncStatus: true },
    });
    if (current?.syncStatus === 'QUEUED' || current?.syncStatus === 'RUNNING') {
      return { status: current.syncStatus, alreadyQueued: true };
    }
    await getPrisma().listeningRule.update({
      where: { id: ruleId },
      data: { syncStatus: 'FAILED', lastSyncError: 'queue_unavailable' },
    });
    return { status: 'FAILED' as const, alreadyQueued: false, error: 'queue_unavailable' };
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
    platform:
      | 'META_FB'
      | 'META_IG'
      | 'TIKTOK'
      | 'LINKEDIN'
      | 'X'
      | 'WHATSAPP'
      | 'REDDIT'
      | 'WEB'
      | 'YOUTUBE';
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
    const existing = input.ruleId
      ? await getPrisma().listeningHit.findUnique({
          where: {
            tenantId_ruleId_platform_externalPostId: {
              tenantId: input.tenantId,
              ruleId: input.ruleId,
              platform: input.platform,
              externalPostId: input.externalPostId,
            },
          },
        })
      : await getPrisma().listeningHit.findFirst({
          where: {
            tenantId: input.tenantId,
            ruleId: null,
            platform: input.platform,
            externalPostId: input.externalPostId,
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
