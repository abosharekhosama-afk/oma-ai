import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, newId } from '@oma/domain';
import { classifySentiment } from '../inbox/sentiment';
import { enqueueListeningPoll } from '../inbox/enqueue-inbox';

export class ListeningService {
  async listRules(tenantId: string) {
    const rows = await getPrisma().listeningRule.findMany({
      where: tenantWhere(tenantId, {}),
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
    if (!name) throw new DomainError('VALIDATION_FAILED', 'name required', 400, 'errors.validation');
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

  async listHits(
    tenantId: string,
    q: { ruleId?: string; sentiment?: string; highPriorityOnly?: boolean; page?: number; limit?: number },
  ) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, Math.max(1, q.limit ?? 40));
    const where = tenantWhere(tenantId, {
      ...(q.ruleId ? { ruleId: q.ruleId } : {}),
      ...(q.sentiment ? { sentiment: q.sentiment as never } : {}),
      ...(q.highPriorityOnly ? { isHighPriority: true } : {}),
    });
    const [total, rows] = await Promise.all([
      getPrisma().listeningHit.count({ where }),
      getPrisma().listeningHit.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      page,
      limit,
      total,
      items: rows.map((h) => ({
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
        matchedKeywords: safeArr(h.matchedKeywordsJson),
        capturedAt: h.capturedAt.toISOString(),
      })),
    };
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
    if (existing) return { id: existing.id, duplicate: true };

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
        matchedKeywordsJson: JSON.stringify(input.matchedKeywords ?? []),
      },
    });
    return { id, duplicate: false, sentiment, isHighPriority };
  }
}

function safeArr(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export const listeningService = new ListeningService();
