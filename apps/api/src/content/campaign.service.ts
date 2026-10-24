import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  newId,
  assertValidTimeline,
  assertBrandNotArchived,
  applyCampaignTransition,
  canTransitionCampaign,
  type CampaignStatus,
  type Track,
  deriveCampaignReviewHint,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

export type LocaleInput = { en: string; ar?: string } | string;

function localePair(input: LocaleInput | undefined, fallback = ''): { en: string; ar: string } {
  if (input == null) return { en: fallback, ar: fallback };
  if (typeof input === 'string') return { en: input.trim(), ar: input.trim() };
  const en = (input.en ?? '').trim() || fallback;
  const ar = (input.ar ?? input.en ?? '').trim() || en;
  return { en, ar };
}

function mapCampaign(
  row: {
    id: string;
    tenantId: string;
    brandId: string;
    nameEn: string;
    nameAr: string;
    descriptionEn: string | null;
    descriptionAr: string | null;
    track: string;
    status: string;
    timelineStart: Date;
    timelineEnd: Date;
    ownerUserId: string | null;
    links: string[];
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  extras?: { content_count?: number; review_hint?: string },
) {
  const r = row as typeof row & {
    objectiveEn?: string | null;
    objectiveAr?: string | null;
    audienceEn?: string | null;
    audienceAr?: string | null;
    channels?: string[];
    strategyId?: string | null;
    budgetAmount?: number | null;
    budgetCurrency?: string | null;
  };
  return {
    id: r.id,
    tenant_id: r.tenantId,
    brand_id: r.brandId,
    name: { en: r.nameEn, ar: r.nameAr },
    description:
      r.descriptionEn || r.descriptionAr
        ? { en: r.descriptionEn ?? '', ar: r.descriptionAr ?? '' }
        : null,
    objective:
      r.objectiveEn || r.objectiveAr
        ? { en: r.objectiveEn ?? '', ar: r.objectiveAr ?? '' }
        : r.descriptionEn || r.descriptionAr
          ? { en: r.descriptionEn ?? '', ar: r.descriptionAr ?? '' }
          : null,
    audience:
      r.audienceEn || r.audienceAr ? { en: r.audienceEn ?? '', ar: r.audienceAr ?? '' } : null,
    channels: r.channels ?? [],
    strategy_id: r.strategyId ?? null,
    budget:
      r.budgetAmount != null
        ? { amount: r.budgetAmount, currency: r.budgetCurrency ?? 'USD', planning_only: true }
        : null,
    track: r.track,
    status: r.status,
    timeline: {
      start: r.timelineStart.toISOString().slice(0, 10),
      end: r.timelineEnd.toISOString().slice(0, 10),
    },
    owner_user_id: r.ownerUserId,
    links: r.links ?? [],
    archived_at: r.archivedAt?.toISOString() ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
    content_count: extras?.content_count ?? 0,
    review_hint: extras?.review_hint ?? 'CLEAR',
  };
}

@Injectable()
export class CampaignService {
  constructor(private readonly audit: AuditService) {}

  private async requireActiveBrand(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) {
      throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
    }
    assertBrandNotArchived(brand.status === 'ARCHIVED' ? (brand.archivedAt ?? new Date()) : null);
    return brand;
  }

  async list(
    tenantId: string,
    brandId: string,
    query: {
      status?: string;
      track?: string;
      q?: string;
      includeArchived?: boolean;
      cursor?: string;
      limit?: number;
    },
  ) {
    await this.requireActiveBrand(tenantId, brandId).catch(async (err) => {
      // allow list on archived brand as read-only empty if brand missing throws
      if (err instanceof DomainError && err.code === 'BRAND_ARCHIVED') {
        /* still allow listing */
        return;
      }
      // re-check brand exists for NOT_FOUND
      const brand = await getPrisma().brandWorkspace.findFirst({
        where: tenantWhere(tenantId, { id: brandId }),
      });
      if (!brand) throw err;
    });

    const limit = Math.min(query.limit ?? 50, 100);
    const where = tenantWhere(tenantId, {
      brandId,
      ...(query.status ? { status: query.status as CampaignStatus } : {}),
      ...(query.track ? { track: query.track as Track } : {}),
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(query.q
        ? {
            OR: [
              { nameEn: { contains: query.q, mode: 'insensitive' as const } },
              { nameAr: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    });

    const rows = await getPrisma().campaign.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    const ids = data.map((r) => r.id);
    const counts = ids.length
      ? await getPrisma().contentItem.groupBy({
          by: ['campaignId'],
          where: {
            tenantId,
            campaignId: { in: ids },
            archivedAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(counts.map((c) => [c.campaignId, c._count._all]));

    const approvalRows = ids.length
      ? await getPrisma().contentItem.findMany({
          where: { tenantId, campaignId: { in: ids }, archivedAt: null },
          select: { campaignId: true, approvalState: true, status: true },
        })
      : [];
    const byCampaign = new Map<string, string[]>();
    for (const a of approvalRows) {
      if (!a.campaignId) continue;
      const list = byCampaign.get(a.campaignId) ?? [];
      list.push(a.approvalState, a.status);
      byCampaign.set(a.campaignId, list);
    }

    return {
      data: data.map((row) =>
        mapCampaign(row, {
          content_count: countMap.get(row.id) ?? 0,
          review_hint: deriveCampaignReviewHint(byCampaign.get(row.id) ?? []),
        }),
      ),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  async get(tenantId: string, campaignId: string) {
    const row = await getPrisma().campaign.findFirst({
      where: tenantWhere(tenantId, { id: campaignId }),
    });
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Campaign not found', 404, 'errors.not_found');
    }
    const contentCount = await getPrisma().contentItem.count({
      where: { tenantId, campaignId, archivedAt: null },
    });
    const approvalRows = await getPrisma().contentItem.findMany({
      where: { tenantId, campaignId, archivedAt: null },
      select: { approvalState: true, status: true },
    });
    const hint = deriveCampaignReviewHint(approvalRows.flatMap((a) => [a.approvalState, a.status]));
    return {
      data: mapCampaign(row, { content_count: contentCount, review_hint: hint }),
    };
  }

  async create(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: {
      name: LocaleInput;
      description?: LocaleInput;
      objective?: LocaleInput;
      audience?: LocaleInput;
      channels?: string[];
      strategyId?: string | null;
      budgetAmount?: number | null;
      budgetCurrency?: string | null;
      track: Track;
      timelineStart: string;
      timelineEnd: string;
      links?: string[];
      status?: CampaignStatus;
    },
    correlationId?: string,
  ) {
    await this.requireActiveBrand(tenantId, brandId);
    const name = localePair(input.name);
    if (!name.en || name.en.length > 200) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid name', 400, 'errors.validation_failed');
    }
    if (input.track !== 'ORGANIC' && input.track !== 'PAID') {
      throw new DomainError('VALIDATION_FAILED', 'Invalid track', 400, 'errors.validation_failed');
    }
    assertValidTimeline(input.timelineStart, input.timelineEnd);
    const desc = input.description ? localePair(input.description) : null;
    const objective = input.objective ? localePair(input.objective) : desc;
    const audience = input.audience ? localePair(input.audience) : null;

    const row = await getPrisma().campaign.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        nameEn: name.en,
        nameAr: name.ar,
        descriptionEn: desc?.en ?? null,
        descriptionAr: desc?.ar ?? null,
        objectiveEn: objective?.en ?? null,
        objectiveAr: objective?.ar ?? null,
        audienceEn: audience?.en ?? null,
        audienceAr: audience?.ar ?? null,
        channels: input.channels ?? [],
        strategyId: input.strategyId ?? null,
        budgetAmount: input.budgetAmount ?? null,
        budgetCurrency: input.budgetCurrency ?? 'USD',
        track: input.track,
        status: input.status ?? 'DRAFT',
        timelineStart: new Date(input.timelineStart),
        timelineEnd: new Date(input.timelineEnd),
        ownerUserId: actorUserId,
        links: input.links ?? [],
      },
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'campaign.created',
      targetType: 'Campaign',
      targetId: row.id,
      correlationId,
    });

    return { data: mapCampaign(row, { content_count: 0, review_hint: 'CLEAR' }) };
  }

  async update(
    tenantId: string,
    actorUserId: string,
    campaignId: string,
    patch: {
      name?: LocaleInput;
      description?: LocaleInput | null;
      objective?: LocaleInput | null;
      audience?: LocaleInput | null;
      channels?: string[];
      strategyId?: string | null;
      budgetAmount?: number | null;
      budgetCurrency?: string | null;
      track?: Track;
      timelineStart?: string;
      timelineEnd?: string;
      links?: string[];
      status?: CampaignStatus;
      transition?: Parameters<typeof applyCampaignTransition>[1];
    },
    correlationId?: string,
  ) {
    const current = await getPrisma().campaign.findFirst({
      where: tenantWhere(tenantId, { id: campaignId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Campaign not found', 404, 'errors.not_found');
    }
    if (current.archivedAt) {
      throw new DomainError(
        'CAMPAIGN_ARCHIVED',
        'Campaign is archived',
        409,
        'error.campaign_archived',
      );
    }
    await this.requireActiveBrand(tenantId, current.brandId);

    let status = current.status as CampaignStatus;
    if (patch.transition) {
      if (!canTransitionCampaign(status, patch.transition)) {
        throw new DomainError(
          'CONFLICT_STATE',
          `Invalid transition ${status} -> ${patch.transition}`,
          409,
          'error.conflict_state',
        );
      }
      status = applyCampaignTransition(status, patch.transition);
    } else if (patch.status) {
      status = patch.status;
    }

    const name = patch.name ? localePair(patch.name) : null;
    const desc =
      patch.description === null
        ? { en: null as string | null, ar: null as string | null }
        : patch.description
          ? localePair(patch.description)
          : null;

    const start = patch.timelineStart ?? current.timelineStart.toISOString().slice(0, 10);
    const end = patch.timelineEnd ?? current.timelineEnd.toISOString().slice(0, 10);
    if (patch.timelineStart || patch.timelineEnd) {
      assertValidTimeline(start, end);
    }

    const objective =
      patch.objective === null
        ? { en: null as string | null, ar: null as string | null }
        : patch.objective
          ? localePair(patch.objective)
          : null;
    const audience =
      patch.audience === null
        ? { en: null as string | null, ar: null as string | null }
        : patch.audience
          ? localePair(patch.audience)
          : null;

    const row = await getPrisma().campaign.update({
      where: { id: campaignId },
      data: {
        ...(name ? { nameEn: name.en, nameAr: name.ar } : {}),
        ...(desc
          ? {
              descriptionEn: desc.en,
              descriptionAr: desc.ar,
            }
          : {}),
        ...(objective ? { objectiveEn: objective.en, objectiveAr: objective.ar } : {}),
        ...(audience ? { audienceEn: audience.en, audienceAr: audience.ar } : {}),
        ...(patch.channels ? { channels: patch.channels } : {}),
        ...(patch.strategyId !== undefined ? { strategyId: patch.strategyId } : {}),
        ...(patch.budgetAmount !== undefined ? { budgetAmount: patch.budgetAmount } : {}),
        ...(patch.budgetCurrency ? { budgetCurrency: patch.budgetCurrency } : {}),
        ...(patch.track ? { track: patch.track } : {}),
        ...(patch.timelineStart ? { timelineStart: new Date(patch.timelineStart) } : {}),
        ...(patch.timelineEnd ? { timelineEnd: new Date(patch.timelineEnd) } : {}),
        ...(patch.links ? { links: patch.links } : {}),
        status,
        ...(status === 'ARCHIVED' ? { archivedAt: new Date() } : {}),
      },
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'campaign.updated',
      targetType: 'Campaign',
      targetId: row.id,
      correlationId,
    });

    return this.get(tenantId, campaignId);
  }

  async archive(tenantId: string, actorUserId: string, campaignId: string, correlationId?: string) {
    return this.update(tenantId, actorUserId, campaignId, { transition: 'archive' }, correlationId);
  }
}
