import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  newId,
  assertBrandNotArchived,
  assertContentBelongsToCampaignBrand,
  resolveContentWorkflow,
  assertCanSchedule,
  applyContentApprovalTransition,
  nextApproverCount,
  type ApprovalPolicy,
  type ApprovalState,
  type ContentStatus,
  type ContentType,
  type Track,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

type LocaleInput = { en: string; ar?: string } | string;

function localePair(input: LocaleInput | undefined, fallback = ''): { en: string; ar: string } {
  if (input == null) return { en: fallback, ar: fallback };
  if (typeof input === 'string') return { en: input.trim(), ar: input.trim() };
  const en = (input.en ?? '').trim() || fallback;
  const ar = (input.ar ?? input.en ?? '').trim() || en;
  return { en, ar };
}

function mapContent(row: {
  id: string;
  tenantId: string;
  brandId: string;
  campaignId: string | null;
  titleEn: string;
  titleAr: string;
  captionEn: string | null;
  captionAr: string | null;
  contentType: string;
  channel: string;
  track: string;
  status: string;
  approvalState: string;
  scheduleState: string;
  plannedAt: Date | null;
  scheduledAt: Date | null;
  timezone: string;
  approverRequired: number;
  approverApproved: number;
  previewAssetUrl: string | null;
  labels: string[];
  assigneeUserId: string | null;
  clientVisible: boolean;
  archivedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}, policy: ApprovalPolicy = 'OPTIONAL') {
  const workflow = resolveContentWorkflow(
    {
      status: row.status,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      plannedAt: row.plannedAt?.toISOString() ?? null,
      scheduleState: row.scheduleState as 'UNSCHEDULED' | 'SCHEDULED',
      approvalState: row.approvalState as ApprovalState,
      approverApproved: row.approverApproved,
      approverRequired: row.approverRequired,
    },
    policy,
  );
  return {
    id: row.id,
    tenant_id: row.tenantId,
    brand_id: row.brandId,
    campaign_id: row.campaignId,
    title: { en: row.titleEn, ar: row.titleAr },
    caption:
      row.captionEn || row.captionAr
        ? { en: row.captionEn ?? '', ar: row.captionAr ?? '' }
        : null,
    content_type: row.contentType,
    channel: row.channel,
    track: row.track,
    status: row.status,
    approval_state: row.approvalState,
    schedule_state: row.scheduleState,
    planned_at: row.plannedAt?.toISOString() ?? null,
    scheduled_at: row.scheduledAt?.toISOString() ?? null,
    timezone: row.timezone,
    approver_required: row.approverRequired,
    approver_approved: row.approverApproved,
    preview_asset_url: row.previewAssetUrl,
    labels: row.labels ?? [],
    assignee_user_id: row.assigneeUserId,
    client_visible: row.clientVisible,
    archived_at: row.archivedAt?.toISOString() ?? null,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    workflow,
  };
}

@Injectable()
export class ContentService {
  constructor(private readonly audit: AuditService) {}

  private async policyForBrand(tenantId: string, brandId: string): Promise<ApprovalPolicy> {
    const prefs = await getPrisma().contentPreferences.findUnique({ where: { brandId } });
    if (prefs && prefs.tenantId === tenantId) {
      return prefs.approvalPolicy as ApprovalPolicy;
    }
    return 'OPTIONAL';
  }

  private async requireActiveBrand(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) {
      throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
    }
    assertBrandNotArchived(brand.status === 'ARCHIVED' ? brand.archivedAt ?? new Date() : null);
    return brand;
  }

  async list(
    tenantId: string,
    brandId: string,
    query: {
      campaignId?: string;
      status?: string;
      track?: string;
      channel?: string;
      q?: string;
      includeArchived?: boolean;
      cursor?: string;
      limit?: number;
    },
  ) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) {
      throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
    }

    const limit = Math.min(query.limit ?? 50, 100);
    const where = tenantWhere(tenantId, {
      brandId,
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(query.status ? { status: query.status as ContentStatus } : {}),
      ...(query.track ? { track: query.track as Track } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.includeArchived ? {} : { archivedAt: null }),
      ...(query.q
        ? {
            OR: [
              { titleEn: { contains: query.q, mode: 'insensitive' as const } },
              { titleAr: { contains: query.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    });

    const rows = await getPrisma().contentItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const policy = await this.policyForBrand(tenantId, brandId);

    return {
      data: data.map((row) => mapContent(row, policy)),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  async get(tenantId: string, contentId: string) {
    const row = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const policy = await this.policyForBrand(tenantId, row.brandId);
    const events = await getPrisma().contentApprovalEvent.findMany({
      where: { tenantId, contentId },
      orderBy: { at: 'desc' },
      take: 50,
    });
    return {
      data: mapContent(row, policy),
      approval_events: events.map((e) => ({
        id: e.id,
        action: e.action,
        actor_user_id: e.actorUserId,
        note: e.noteEn || e.noteAr ? { en: e.noteEn ?? '', ar: e.noteAr ?? '' } : null,
        at: e.at.toISOString(),
      })),
    };
  }

  async create(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: {
      title: LocaleInput;
      caption?: LocaleInput;
      campaignId?: string | null;
      contentType: ContentType;
      channel: string;
      track?: Track;
      plannedAt?: string | null;
      labels?: string[];
    },
    correlationId?: string,
  ) {
    await this.requireActiveBrand(tenantId, brandId);
    const title = localePair(input.title);
    if (!title.en) {
      throw new DomainError('VALIDATION_FAILED', 'Title required', 400, 'errors.validation_failed');
    }
    let track: Track = input.track ?? 'ORGANIC';
    if (input.campaignId) {
      const campaign = await getPrisma().campaign.findFirst({
        where: tenantWhere(tenantId, { id: input.campaignId, brandId }),
      });
      if (!campaign || campaign.archivedAt) {
        throw new DomainError('NOT_FOUND', 'Campaign not found', 404, 'errors.not_found');
      }
      assertContentBelongsToCampaignBrand({
        contentBrandId: brandId,
        campaignBrandId: campaign.brandId,
      });
      track = input.track ?? (campaign.track as Track);
    }
    const caption = input.caption ? localePair(input.caption) : null;
    const prefs = await this.policyForBrand(tenantId, brandId);

    const row = await getPrisma().contentItem.create({
      data: {
        id: newId(),
        tenantId,
        brandId,
        campaignId: input.campaignId ?? null,
        titleEn: title.en,
        titleAr: title.ar,
        captionEn: caption?.en ?? null,
        captionAr: caption?.ar ?? null,
        contentType: input.contentType,
        channel: input.channel,
        track,
        status: 'DRAFT',
        approvalState: 'NOT_REQUESTED',
        scheduleState: 'UNSCHEDULED',
        plannedAt: input.plannedAt ? new Date(input.plannedAt) : null,
        timezone: 'Asia/Dubai',
        approverRequired: 1,
        approverApproved: 0,
        labels: input.labels ?? [],
        createdBy: actorUserId,
      },
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.created',
      targetType: 'ContentItem',
      targetId: row.id,
      correlationId,
    });

    return { data: mapContent(row, prefs) };
  }

  async update(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    patch: {
      title?: LocaleInput;
      caption?: LocaleInput | null;
      campaignId?: string | null;
      channel?: string;
      track?: Track;
      plannedAt?: string | null;
      labels?: string[];
      clientVisible?: boolean;
    },
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    if (current.archivedAt) {
      throw new DomainError('CONFLICT_STATE', 'Content is archived', 409, 'error.conflict_state');
    }
    await this.requireActiveBrand(tenantId, current.brandId);

    if (patch.campaignId) {
      const campaign = await getPrisma().campaign.findFirst({
        where: tenantWhere(tenantId, { id: patch.campaignId }),
      });
      if (!campaign) {
        throw new DomainError('NOT_FOUND', 'Campaign not found', 404, 'errors.not_found');
      }
      assertContentBelongsToCampaignBrand({
        contentBrandId: current.brandId,
        campaignBrandId: campaign.brandId,
      });
    }

    const title = patch.title ? localePair(patch.title) : null;
    const caption =
      patch.caption === null
        ? { en: null as string | null, ar: null as string | null }
        : patch.caption
          ? localePair(patch.caption)
          : null;

    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        ...(title ? { titleEn: title.en, titleAr: title.ar } : {}),
        ...(caption ? { captionEn: caption.en, captionAr: caption.ar } : {}),
        ...(patch.campaignId !== undefined ? { campaignId: patch.campaignId } : {}),
        ...(patch.channel ? { channel: patch.channel } : {}),
        ...(patch.track ? { track: patch.track } : {}),
        ...(patch.plannedAt !== undefined
          ? { plannedAt: patch.plannedAt ? new Date(patch.plannedAt) : null }
          : {}),
        ...(patch.labels ? { labels: patch.labels } : {}),
        ...(patch.clientVisible !== undefined ? { clientVisible: patch.clientVisible } : {}),
      },
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.updated',
      targetType: 'ContentItem',
      targetId: row.id,
      correlationId,
    });

    return this.get(tenantId, contentId);
  }

  private async writeEvent(
    tenantId: string,
    contentId: string,
    actorUserId: string,
    action: string,
    note?: LocaleInput,
  ) {
    const n = note ? localePair(note) : null;
    await getPrisma().contentApprovalEvent.create({
      data: {
        id: newId(),
        tenantId,
        contentId,
        actorUserId,
        action,
        noteEn: n?.en ?? null,
        noteAr: n?.ar ?? null,
      },
    });
  }

  async requestApproval(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    note?: LocaleInput,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const next = applyContentApprovalTransition({
      command: 'request_approval',
      approvalState: current.approvalState as ApprovalState,
      status: current.status as ContentStatus,
      approverApproved: current.approverApproved,
      approverRequired: current.approverRequired,
    });
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        approvalState: next.approvalState,
        status: next.status,
        approverApproved: nextApproverCount(
          current.approverApproved,
          next.deltaApproved,
          current.approverRequired,
        ),
      },
    });
    await this.writeEvent(tenantId, contentId, actorUserId, 'REQUEST', note);
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.approval_requested',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    const policy = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, policy) };
  }

  async approve(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    note?: LocaleInput,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    let next;
    try {
      next = applyContentApprovalTransition({
        command: 'approve',
        approvalState: current.approvalState as ApprovalState,
        status: current.status as ContentStatus,
        approverApproved: current.approverApproved,
        approverRequired: current.approverRequired,
      });
    } catch {
      throw new DomainError(
        'CONFLICT_STATE',
        'Cannot approve in current state',
        409,
        'error.conflict_state',
      );
    }
    const approved = nextApproverCount(
      current.approverApproved,
      next.deltaApproved,
      current.approverRequired,
    );
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        approvalState: next.approvalState,
        status: next.status,
        approverApproved: approved,
      },
    });
    await this.writeEvent(tenantId, contentId, actorUserId, 'APPROVE', note);
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.approved',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    const policy = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, policy) };
  }

  async requestChanges(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    note: LocaleInput,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    let next;
    try {
      next = applyContentApprovalTransition({
        command: 'request_changes',
        approvalState: current.approvalState as ApprovalState,
        status: current.status as ContentStatus,
        approverApproved: current.approverApproved,
        approverRequired: current.approverRequired,
      });
    } catch {
      throw new DomainError(
        'CONFLICT_STATE',
        'Cannot request changes in current state',
        409,
        'error.conflict_state',
      );
    }
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        approvalState: next.approvalState,
        status: next.status,
        approverApproved: 0,
      },
    });
    await this.writeEvent(tenantId, contentId, actorUserId, 'REQUEST_CHANGES', note);
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.changes_requested',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    const policy = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, policy) };
  }

  async schedule(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    input: { scheduledAt: string; timezone?: string },
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const policy = await this.policyForBrand(tenantId, current.brandId);
    assertCanSchedule(
      {
        status: current.status,
        scheduledAt: current.scheduledAt?.toISOString() ?? null,
        plannedAt: current.plannedAt?.toISOString() ?? null,
        scheduleState: current.scheduleState as 'UNSCHEDULED' | 'SCHEDULED',
        approvalState: current.approvalState as ApprovalState,
        approverApproved: current.approverApproved,
        approverRequired: current.approverRequired,
      },
      policy,
    );
    const when = new Date(input.scheduledAt);
    if (Number.isNaN(when.getTime())) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid scheduledAt', 400, 'errors.validation_failed');
    }
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        scheduledAt: when,
        plannedAt: current.plannedAt ?? when,
        scheduleState: 'SCHEDULED',
        status: 'SCHEDULED',
        ...(input.timezone ? { timezone: input.timezone } : {}),
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.scheduled',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    return { data: mapContent(row, policy) };
  }

  async unschedule(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        scheduleState: 'UNSCHEDULED',
        scheduledAt: null,
        status: current.approvalState === 'APPROVED' ? 'APPROVED' : 'DRAFT',
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.unscheduled',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    const policy = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, policy) };
  }

  async archive(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: { archivedAt: new Date() },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.archived',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    const policy = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, policy) };
  }

  async getPreferences(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) {
      throw new DomainError('NOT_FOUND', 'Brand not found', 404, 'errors.not_found');
    }
    const prefs = await getPrisma().contentPreferences.findUnique({ where: { brandId } });
    return {
      data: {
        brand_id: brandId,
        approval_policy: (prefs?.approvalPolicy as ApprovalPolicy) ?? 'OPTIONAL',
        default_timezone: prefs?.defaultTimezone ?? 'Asia/Dubai',
      },
    };
  }

  async updatePreferences(
    tenantId: string,
    brandId: string,
    patch: { approvalPolicy?: ApprovalPolicy; defaultTimezone?: string },
  ) {
    await this.requireActiveBrand(tenantId, brandId);
    const row = await getPrisma().contentPreferences.upsert({
      where: { brandId },
      create: {
        brandId,
        tenantId,
        approvalPolicy: patch.approvalPolicy ?? 'OPTIONAL',
        defaultTimezone: patch.defaultTimezone ?? 'Asia/Dubai',
      },
      update: {
        ...(patch.approvalPolicy ? { approvalPolicy: patch.approvalPolicy } : {}),
        ...(patch.defaultTimezone ? { defaultTimezone: patch.defaultTimezone } : {}),
      },
    });
    return {
      data: {
        brand_id: brandId,
        approval_policy: row.approvalPolicy,
        default_timezone: row.defaultTimezone,
      },
    };
  }
}
