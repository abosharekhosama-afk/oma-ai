import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { brandTimezone } from '../brand/brand.service';
import { parseTimezone } from '../brand/brand-input';
import {
  DomainError,
  newId,
  isValidIanaTimezone,
  parseScheduleInstant,
  assertBrandNotArchived,
  assertContentBelongsToCampaignBrand,
  resolveContentWorkflow,
  assertCanSchedule,
  assertCanPublish,
  applyContentApprovalTransition,
  nextApproverCount,
  type ApprovalPolicy,
  type ApprovalState,
  type ContentStatus,
  type ContentType,
  type Track,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { mediaPlaybackUrl } from '../media/media.service';
import { syncContentPublishRollup } from '../social/publish-target-sync';
import { rollupToLegacyPublishState } from '@oma/domain';


function mapComment(c: {
  id: string;
  authorUserId: string;
  bodyEn: string;
  bodyAr: string;
  createdAt: Date;
  isInternal?: boolean;
  parentId?: string | null;
  resolvedAt?: Date | null;
  reactionsJson?: string | null;
  attachmentMediaIds?: string[];
}) {
  let reactions: Record<string, string[]> = {};
  try {
    reactions = c.reactionsJson ? (JSON.parse(c.reactionsJson) as Record<string, string[]>) : {};
  } catch {
    reactions = {};
  }
  return {
    id: c.id,
    author_user_id: c.authorUserId,
    body: { en: c.bodyEn, ar: c.bodyAr },
    at: c.createdAt.toISOString(),
    internal: Boolean(c.isInternal),
    parent_id: c.parentId ?? null,
    resolved_at: c.resolvedAt?.toISOString() ?? null,
    reactions,
    attachment_media_ids: c.attachmentMediaIds ?? [],
  };
}

/** Resolve ordered post media; the first item remains the compatibility preview. */
async function resolvePreviewAssets(tenantId: string, brandId: string, value: unknown) {
  if (value === undefined) return undefined;
  const ids =
    value === null || value === ''
      ? []
      : typeof value === 'string'
        ? [value.trim()]
        : Array.isArray(value)
          ? value.map((id) => (typeof id === 'string' ? id.trim() : '')).filter(Boolean)
          : null;
  if (!ids)
    throw new DomainError(
      'VALIDATION_FAILED',
      'Media ids must be strings',
      400,
      'errors.validation_failed',
    );
  const orderedIds = [...new Set(ids)];
  if (!orderedIds.length) return { previewAssetId: null, previewAssetUrl: null, mediaAssetIds: [] };
  const assets = await getPrisma().mediaAsset.findMany({
    where: tenantWhere(tenantId, { id: { in: orderedIds }, brandId, kind: 'posts' }),
    select: { id: true, mime: true },
  });
  if (assets.length !== orderedIds.length)
    throw new DomainError('NOT_FOUND', 'Media not found', 404, 'errors.not_found');
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const first = byId.get(orderedIds[0]!);
  return {
    previewAssetId: first!.id,
    previewAssetUrl: mediaPlaybackUrl(first!.id, first!.mime),
    mediaAssetIds: orderedIds,
  };
}

type LocaleInput = { en: string; ar?: string } | string;

function localePair(input: LocaleInput | undefined, fallback = ''): { en: string; ar: string } {
  if (input == null) return { en: fallback, ar: fallback };
  if (typeof input === 'string') return { en: input.trim(), ar: input.trim() };
  const en = (input.en ?? '').trim() || fallback;
  const ar = (input.ar ?? input.en ?? '').trim() || en;
  return { en, ar };
}

function mapContent(
  row: {
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
    previewAssetId?: string | null;
    mediaAssetIds?: string[];
    labels: string[];
    assigneeUserId: string | null;
    clientVisible: boolean;
    archivedAt: Date | null;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    socialPageId?: string | null;
    publishState?: string;
    publishAttempts?: number;
    lastPublishError?: string | null;
    workerPickedAt?: Date | null;
    lastPublishSkipReason?: string | null;
    nextPublishAt?: Date | null;
    externalPostUrl?: string | null;
    publishedAt?: Date | null;
    syncGroupId?: string | null;
    preferredAudience?: string | null;
  },
  policy: ApprovalPolicy = 'OPTIONAL',
) {
  const workflow = resolveContentWorkflow(
    {
      status: row.status,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      plannedAt: row.plannedAt?.toISOString() ?? null,
      scheduleState: row.scheduleState as 'UNSCHEDULED' | 'SCHEDULED',
      approvalState: row.approvalState as ApprovalState,
      approverApproved: row.approverApproved,
      approverRequired: row.approverRequired,
      archivedAt: row.archivedAt?.toISOString() ?? null,
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
      row.captionEn || row.captionAr ? { en: row.captionEn ?? '', ar: row.captionAr ?? '' } : null,
    content_type: row.contentType,
    channel: row.channel,
    track: row.track,
    status: row.status,
    approval_state: row.approvalState,
    schedule_state: row.archivedAt ? 'UNSCHEDULED' : row.scheduleState,
    planned_at: row.plannedAt?.toISOString() ?? null,
    scheduled_at: row.scheduledAt?.toISOString() ?? null,
    timezone: row.timezone,
    approver_required: row.approverRequired,
    approver_approved: row.approverApproved,
    preview_asset_url: row.previewAssetUrl,
    preview_asset_id: row.previewAssetId ?? null,
    media_asset_ids: row.mediaAssetIds ?? (row.previewAssetId ? [row.previewAssetId] : []),
    labels: row.labels ?? [],
    assignee_user_id: row.assigneeUserId,
    client_visible: row.clientVisible,
    sync_group_id: row.syncGroupId ?? null,
    preferred_audience: row.preferredAudience ?? null,
    archived_at: row.archivedAt?.toISOString() ?? null,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    workflow,
    publishing: {
      social_page_id: row.socialPageId ?? null,
      social_page_ids:
        (row as { publishTargets?: { socialPageId: string }[] }).publishTargets?.map(
          (t) => t.socialPageId,
        ) ?? (row.socialPageId ? [row.socialPageId] : []),
      rollup_state: row.publishState ?? 'NONE',
      state: rollupToLegacyPublishState(
        (row.publishState ?? 'NONE') as import('@oma/domain').ContentPublishRollupState,
      ),
      publish_targets:
        (row as { publishTargets?: Array<{
          id: string;
          socialPageId: string;
          publishState: string;
          externalPostUrl: string | null;
          lastPublishError: string | null;
        }> }).publishTargets?.map((t) => ({
          id: t.id,
          social_page_id: t.socialPageId,
          state: t.publishState,
          external_post_url: t.externalPostUrl,
          last_error: t.lastPublishError,
        })) ?? [],
      attempts: row.publishAttempts ?? 0,
      last_error: row.lastPublishError ?? null,
      worker_picked_at: row.workerPickedAt?.toISOString() ?? null,
      skip_reason: row.lastPublishSkipReason ?? null,
      next_publish_at: row.nextPublishAt?.toISOString() ?? null,
      external_post_url: row.externalPostUrl ?? null,
      published_at: row.publishedAt?.toISOString() ?? null,
    },
  };
}

/** Parse an optional ISO date from a request body; invalid values are a 400, never a 500. */
export function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = typeof value === 'string' || value instanceof Date ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) {
    throw new DomainError('VALIDATION_FAILED', `Invalid ${field}`, 400, 'errors.validation_failed');
  }
  return date;
}

/** Map the workspace setting value (none | optional | required | legacy multi_level) to a policy. */
export function workspaceModeToPolicy(mode: string | null | undefined): ApprovalPolicy {
  const m = (mode ?? '').toLowerCase();
  if (m === 'none') return 'NONE';
  if (m === 'required' || m === 'multi_level') return 'REQUIRED';
  return 'OPTIONAL';
}

function workflowSource(current: {
  status: string;
  scheduledAt: Date | null;
  plannedAt: Date | null;
  scheduleState: string;
  approvalState: string;
  approverApproved: number;
  approverRequired: number;
  archivedAt: Date | null;
}) {
  return {
    status: current.status,
    scheduledAt: current.scheduledAt?.toISOString() ?? null,
    plannedAt: current.plannedAt?.toISOString() ?? null,
    scheduleState: current.scheduleState as 'UNSCHEDULED' | 'SCHEDULED',
    approvalState: current.approvalState as ApprovalState,
    approverApproved: current.approverApproved,
    approverRequired: current.approverRequired,
    archivedAt: current.archivedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class ContentService {
  constructor(private readonly audit: AuditService) {}

  /**
   * Effective approval policy for a brand: an explicit per-brand preference wins, otherwise the
   * workspace-level policy (Settings → Approvals), otherwise OPTIONAL.
   */
  private async policyForBrand(tenantId: string, brandId: string): Promise<ApprovalPolicy> {
    return (await this.approvalConfig(tenantId, brandId)).policy;
  }

  async approvalConfig(
    tenantId: string,
    brandId: string,
  ): Promise<{ policy: ApprovalPolicy; requiredApprovers: number }> {
    const prisma = getPrisma();
    const [prefs, ws] = await Promise.all([
      prisma.contentPreferences.findUnique({ where: { brandId } }),
      prisma.workspaceSetting.findUnique({ where: { tenantId } }).catch(() => null),
    ]);
    const wsPolicy = workspaceModeToPolicy(ws?.approvalMode);
    const policy =
      prefs && prefs.tenantId === tenantId ? (prefs.approvalPolicy as ApprovalPolicy) : wsPolicy;
    const requiredApprovers =
      policy === 'REQUIRED' ? Math.min(5, Math.max(1, ws?.requiredApprovers ?? 1)) : 1;
    return { policy, requiredApprovers };
  }

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
      campaignId?: string;
      status?: string;
      track?: string;
      channel?: string;
      q?: string;
      includeArchived?: boolean;
      cursor?: string;
      limit?: number;
      /** When true (client/guest membership), omit posts marked hide-from-clients. */
      clientAudience?: boolean;
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
      ...(query.clientAudience ? { clientVisible: true } : {}),
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
      include: { publishTargets: true },
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const policy = await this.policyForBrand(tenantId, brandId);

    const mapped = data.map((row) => mapContent(row, policy));
    const enriched = await this.enrichContentNames(mapped);
    return {
      data: enriched,
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  /** Resolve assignee display names so the UI never shows raw user ULIDs. */
  private async enrichContentNames<T extends { assignee_user_id: string | null }>(
    rows: T[],
  ): Promise<Array<T & { assignee_name: string | null }>> {
    if (!rows.length) return [];
    const ids = [...new Set(rows.map((r) => r.assignee_user_id).filter(Boolean) as string[])];
    const users = ids.length
      ? await getPrisma().user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const map = new Map(
      users.map((u) => [u.id, (u.name && u.name.trim()) || u.email || 'Team member']),
    );
    return rows.map((row) => ({
      ...row,
      assignee_name: row.assignee_user_id ? map.get(row.assignee_user_id) || 'Team member' : null,
    }));
  }

  async get(tenantId: string, contentId: string, opts?: { clientAudience?: boolean }) {
    const row = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: { publishTargets: true },
    });
    if (!row) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    if (opts?.clientAudience && row.clientVisible === false) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const policy = await this.policyForBrand(tenantId, row.brandId);
    const events = await getPrisma().contentApprovalEvent.findMany({
      where: { tenantId, contentId },
      orderBy: { at: 'desc' },
      take: 50,
    });
    const comments = await getPrisma().contentComment.findMany({
      where: { tenantId, contentId },
      orderBy: { createdAt: 'asc' },
      take: 100,
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
      comments: comments.map((c) => mapComment(c)),
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
      preview_asset_id?: string | null;
      media_asset_ids?: string[] | null;
    },
    correlationId?: string,
  ) {
    await this.requireActiveBrand(tenantId, brandId);
    const media = await resolvePreviewAssets(
      tenantId,
      brandId,
      input.media_asset_ids ?? input.preview_asset_id,
    );
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
        plannedAt: parseOptionalDate(input.plannedAt, 'plannedAt'),
        timezone: await brandTimezone(tenantId, brandId),
        approverRequired: 1,
        approverApproved: 0,
        labels: input.labels ?? [],
        ...(media ?? {}),
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
      preview_asset_id?: string | null;
      media_asset_ids?: string[] | null;
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

    const media = await resolvePreviewAssets(
      tenantId,
      current.brandId,
      patch.media_asset_ids ?? patch.preview_asset_id,
    );
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
          ? { plannedAt: parseOptionalDate(patch.plannedAt, 'plannedAt') }
          : {}),
        ...(patch.labels ? { labels: patch.labels } : {}),
        ...(patch.clientVisible !== undefined ? { clientVisible: patch.clientVisible } : {}),
        ...(media ?? {}),
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
    if (current.archivedAt) {
      throw new DomainError('CONFLICT_STATE', 'Content is archived', 409, 'error.content_archived');
    }
    const { policy: reqPolicy, requiredApprovers } = await this.approvalConfig(
      tenantId,
      current.brandId,
    );
    if (reqPolicy === 'NONE') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Approvals are turned off for this workspace',
        409,
        'error.approvals_disabled',
      );
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
        approverRequired: requiredApprovers,
        approverApproved: 0,
        // Re-review clears any local schedule; it must be re-scheduled after approval.
        ...(current.scheduleState === 'SCHEDULED'
          ? { scheduleState: 'UNSCHEDULED', scheduledAt: null }
          : {}),
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
    if (current.approverRequired > 1) {
      const lastRequest = await getPrisma().contentApprovalEvent.findFirst({
        where: { tenantId, contentId, action: 'REQUEST' },
        orderBy: { at: 'desc' },
      });
      const already = await getPrisma().contentApprovalEvent.findFirst({
        where: {
          tenantId,
          contentId,
          action: 'APPROVE',
          actorUserId,
          ...(lastRequest ? { at: { gte: lastRequest.at } } : {}),
        },
      });
      if (already) {
        throw new DomainError(
          'CONFLICT_STATE',
          'You already approved this post; another approver is needed',
          409,
          'error.already_approved',
          [{ approved: current.approverApproved, required: current.approverRequired }],
        );
      }
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

  async reject(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    note?: LocaleInput,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    let next;
    try {
      next = applyContentApprovalTransition({
        command: 'reject',
        approvalState: current.approvalState as ApprovalState,
        status: current.status as ContentStatus,
        approverApproved: current.approverApproved,
        approverRequired: current.approverRequired,
      });
    } catch {
      throw new DomainError(
        'CONFLICT_STATE',
        'Cannot reject in current state',
        409,
        'error.conflict_state',
      );
    }
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: { approvalState: next.approvalState, status: next.status, approverApproved: 0 },
    });
    await this.writeEvent(tenantId, contentId, actorUserId, 'REJECT', note);
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.rejected',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    const pol = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, pol) };
  }

  async markPublishedSample(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    if (current.archivedAt) {
      throw new DomainError('CONFLICT_STATE', 'Content is archived', 409, 'error.conflict_state');
    }
    assertCanPublish(workflowSource(current), await this.policyForBrand(tenantId, current.brandId));
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: { status: 'PUBLISHED_SAMPLE', scheduleState: 'UNSCHEDULED' },
    });
    await this.writeEvent(tenantId, contentId, actorUserId, 'PUBLISH_SAMPLE', {
      en: 'Marked as published (sample)',
      ar: 'تم التعليم كمنشور (تجريبي)',
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.published_sample',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    const pol = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, pol) };
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
    assertCanSchedule(workflowSource(current), policy);
    const tz = isValidIanaTimezone(input.timezone)
      ? input.timezone.trim()
      : await brandTimezone(tenantId, current.brandId);
    const when = parseScheduleInstant(input.scheduledAt, tz);
    if (!when) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Invalid scheduledAt',
        400,
        'errors.validation_failed',
      );
    }
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        scheduledAt: when,
        scheduleState: 'SCHEDULED',
        status: 'SCHEDULED',
        timezone: tz,
      },
    });
    const targetCount = await getPrisma().contentPublishTarget.count({
      where: { contentItemId: contentId },
    });
    if (targetCount > 0) {
      await getPrisma().contentPublishTarget.updateMany({
        where: { contentItemId: contentId, publishState: { not: 'PUBLISHED' } },
        data: {
          publishState: 'QUEUED',
          publishAttempts: 0,
          nextPublishAt: null,
          lastPublishError: null,
        },
      });
      await syncContentPublishRollup(contentId);
    }
    const refreshed = await getPrisma().contentItem.findUniqueOrThrow({
      where: { id: contentId },
      include: { publishTargets: true },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.scheduled',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    return { data: mapContent(refreshed, policy) };
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
        ...(current.publishState === 'ALL_SUCCEEDED'
          ? {}
          : { publishState: 'NONE', nextPublishAt: null }),
      },
    });
    if (current.publishState !== 'ALL_SUCCEEDED') {
      await getPrisma().contentPublishTarget.updateMany({
        where: { contentItemId: contentId, publishState: { not: 'PUBLISHED' } },
        data: { publishState: 'NONE', nextPublishAt: null },
      });
      await syncContentPublishRollup(contentId);
    }
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

  async archive(tenantId: string, actorUserId: string, contentId: string, correlationId?: string) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        archivedAt: new Date(),
        scheduleState: 'UNSCHEDULED',
        scheduledAt: null,
        ...(current.status === 'SCHEDULED'
          ? { status: current.approvalState === 'APPROVED' ? 'APPROVED' : 'DRAFT' }
          : {}),
      },
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

  /** Create a new draft copy of a post (Planable "Repost"). */
  async duplicate(
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
    await this.requireActiveBrand(tenantId, current.brandId);
    const mediaIds =
      (current as { mediaAssetIds?: string[] }).mediaAssetIds ??
      (current.previewAssetId ? [current.previewAssetId] : []);
    const resolved = mediaIds.length
      ? await resolvePreviewAssets(tenantId, current.brandId, mediaIds)
      : null;
    const media = resolved ?? {
      previewAssetId: null as string | null,
      previewAssetUrl: null as string | null,
      mediaAssetIds: [] as string[],
    };
    const row = await getPrisma().contentItem.create({
      data: {
        id: newId(),
        tenantId,
        brandId: current.brandId,
        campaignId: current.campaignId,
        titleEn: current.titleEn,
        titleAr: current.titleAr,
        captionEn: current.captionEn,
        captionAr: current.captionAr,
        contentType: current.contentType,
        channel: current.channel,
        track: current.track,
        status: 'DRAFT',
        approvalState: 'NOT_REQUESTED',
        scheduleState: 'UNSCHEDULED',
        plannedAt: null,
        scheduledAt: null,
        timezone: current.timezone,
        approverRequired: 1,
        approverApproved: 0,
        labels: current.labels ?? [],
        clientVisible: current.clientVisible !== false,
        previewAssetId: media.previewAssetId,
        previewAssetUrl: media.previewAssetUrl,
        mediaAssetIds: media.mediaAssetIds,
        createdBy: actorUserId,
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.duplicated',
      targetType: 'ContentItem',
      targetId: row.id,
      afterRef: contentId,
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
    const effective = await this.approvalConfig(tenantId, brandId);
    return {
      data: {
        brand_id: brandId,
        // Effective policy: brand override when set, otherwise the workspace policy.
        approval_policy: effective.policy,
        approval_policy_source: prefs ? 'brand' : 'workspace',
        required_approvers: effective.requiredApprovers,
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
    if (patch.defaultTimezone !== undefined)
      patch.defaultTimezone = parseTimezone(patch.defaultTimezone);
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

  async listComments(tenantId: string, contentId: string) {
    const row = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const comments = await getPrisma().contentComment.findMany({
      where: { tenantId, contentId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return { data: comments.map((c) => mapComment(c)) };
  }

  async addComment(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    body: LocaleInput,
    correlationId?: string,
    extra?: {
      internal?: boolean;
      parentId?: string | null;
      attachmentMediaIds?: string[];
    },
  ) {
    const row = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const pair = localePair(body);
    if (!pair.en.trim()) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Comment body required',
        400,
        'errors.validation_failed',
      );
    }
    if (extra?.parentId) {
      const parent = await getPrisma().contentComment.findFirst({
        where: { id: extra.parentId, tenantId, contentId },
      });
      if (!parent) throw new DomainError('NOT_FOUND', 'Parent comment not found', 404, 'errors.not_found');
    }
    const comment = await getPrisma().contentComment.create({
      data: {
        id: newId(),
        tenantId,
        contentId,
        authorUserId: actorUserId,
        bodyEn: pair.en,
        bodyAr: pair.ar,
        isInternal: Boolean(extra?.internal),
        parentId: extra?.parentId ?? null,
        attachmentMediaIds: extra?.attachmentMediaIds ?? [],
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.comment_added',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    return { data: mapComment(comment) };
  }

  async deleteComment(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    commentId: string,
    correlationId?: string,
  ) {
    const comment = await getPrisma().contentComment.findFirst({
      where: { id: commentId, tenantId, contentId },
    });
    if (!comment) throw new DomainError('NOT_FOUND', 'Comment not found', 404, 'errors.not_found');
    await getPrisma().contentComment.delete({ where: { id: commentId } });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.comment_deleted',
      targetType: 'ContentComment',
      targetId: commentId,
      correlationId,
    });
    return { data: { id: commentId, deleted: true } };
  }

  async updateComment(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    commentId: string,
    body: LocaleInput,
    correlationId?: string,
  ) {
    const comment = await getPrisma().contentComment.findFirst({
      where: { id: commentId, tenantId, contentId },
    });
    if (!comment) throw new DomainError('NOT_FOUND', 'Comment not found', 404, 'errors.not_found');
    if (comment.authorUserId !== actorUserId) {
      throw new DomainError('PERMISSION_DENIED', 'Only the author can edit this comment', 403, 'errors.permission_denied');
    }
    const pair = localePair(body);
    if (!pair.en.trim()) {
      throw new DomainError('VALIDATION_FAILED', 'Comment body required', 400, 'errors.validation_failed');
    }
    const updated = await getPrisma().contentComment.update({
      where: { id: commentId },
      data: { bodyEn: pair.en, bodyAr: pair.ar },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.comment_updated',
      targetType: 'ContentComment',
      targetId: commentId,
      correlationId,
    });
    return { data: mapComment(updated) };
  }

  async resolveComment(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    commentId: string,
    resolved = true,
    correlationId?: string,
  ) {
    const comment = await getPrisma().contentComment.findFirst({
      where: { id: commentId, tenantId, contentId },
    });
    if (!comment) throw new DomainError('NOT_FOUND', 'Comment not found', 404, 'errors.not_found');
    const updated = await getPrisma().contentComment.update({
      where: { id: commentId },
      data: { resolvedAt: resolved ? new Date() : null },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: resolved ? 'content.comment_resolved' : 'content.comment_unresolved',
      targetType: 'ContentComment',
      targetId: commentId,
      correlationId,
    });
    return { data: mapComment(updated) };
  }

  async reactToComment(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    commentId: string,
    emoji: string,
    correlationId?: string,
  ) {
    const comment = await getPrisma().contentComment.findFirst({
      where: { id: commentId, tenantId, contentId },
    });
    if (!comment) throw new DomainError('NOT_FOUND', 'Comment not found', 404, 'errors.not_found');
    const key = (emoji || '').trim().slice(0, 16);
    if (!key) {
      throw new DomainError('VALIDATION_FAILED', 'Emoji required', 400, 'errors.validation_failed');
    }
    let reactions: Record<string, string[]> = {};
    try {
      reactions = comment.reactionsJson
        ? (JSON.parse(comment.reactionsJson) as Record<string, string[]>)
        : {};
    } catch {
      reactions = {};
    }
    const list = new Set(reactions[key] ?? []);
    if (list.has(actorUserId)) list.delete(actorUserId);
    else list.add(actorUserId);
    if (list.size) reactions[key] = [...list];
    else delete reactions[key];
    const updated = await getPrisma().contentComment.update({
      where: { id: commentId },
      data: { reactionsJson: JSON.stringify(reactions) },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.comment_reacted',
      targetType: 'ContentComment',
      targetId: commentId,
      correlationId,
    });
    return { data: mapComment(updated) };
  }

  /** Publish now: schedule for now (approval-gated) and enqueue worker jobs like due scheduled posts. */
  async publishNow(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    correlationId?: string,
  ) {
    const { enqueuePublishTargetsNow } = await import('../social/enqueue-publish-now');
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: { publishTargets: true },
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    if (current.archivedAt) {
      throw new DomainError('CONFLICT_STATE', 'Content is archived', 409, 'error.conflict_state');
    }
    const policy = await this.policyForBrand(tenantId, current.brandId);
    assertCanPublish(workflowSource(current), policy);
    if (!current.publishTargets.length && !current.socialPageId) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Select at least one channel before publishing',
        400,
        'errors.validation_failed',
      );
    }
    const now = new Date();
    const tz = current.timezone || (await brandTimezone(tenantId, current.brandId));
    await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        scheduledAt: now,
        scheduleState: 'SCHEDULED',
        status: 'SCHEDULED',
        timezone: tz,
        lastPublishSkipReason: null,
      },
    });
    if (current.socialPageId && !current.publishTargets.length) {
      await getPrisma().contentPublishTarget.create({
        data: {
          id: newId(),
          tenantId,
          contentItemId: contentId,
          socialPageId: current.socialPageId,
          publishState: 'QUEUED',
          publishAttempts: 0,
          nextPublishAt: null,
          lastPublishError: null,
        },
      });
    } else {
      await getPrisma().contentPublishTarget.updateMany({
        where: { contentItemId: contentId, publishState: { not: 'PUBLISHED' } },
        data: {
          publishState: 'QUEUED',
          publishAttempts: 0,
          nextPublishAt: null,
          lastPublishError: null,
        },
      });
    }
    await syncContentPublishRollup(contentId);
    const enqueued = await enqueuePublishTargetsNow(contentId);
    await this.writeEvent(tenantId, contentId, actorUserId, 'PUBLISH_NOW', {
      en: 'Queued for publishing now',
      ar: 'تمت الإضافة إلى قائمة النشر الآن',
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.publish_now',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
      afterRef: String(enqueued),
    });
    const refreshed = await getPrisma().contentItem.findUniqueOrThrow({
      where: { id: contentId },
      include: { publishTargets: true },
    });
    return { data: mapContent(refreshed, policy), enqueued };
  }

  async setPreferredAudience(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    audience: string | null,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: { preferredAudience: audience?.trim() || null },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.preferred_audience_set',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    const policy = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, policy) };
  }

  /** Detach one social page into its own post (Planable detach from group). */
  async detachPublishTarget(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    socialPageId: string,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: { publishTargets: true },
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const target = current.publishTargets.find((t) => t.socialPageId === socialPageId);
    if (!target) throw new DomainError('NOT_FOUND', 'Publish target not found', 404, 'errors.not_found');
    if (current.publishTargets.length <= 1) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Cannot detach the only channel from this post',
        409,
        'error.conflict_state',
      );
    }
    const page = await getPrisma().socialPage.findFirst({
      where: { id: socialPageId, tenantId },
    });
    const dup = await this.duplicate(tenantId, actorUserId, contentId, correlationId);
    const newId_ = (dup.data as { id: string }).id;
    const groupId = current.syncGroupId || current.id;
    await getPrisma().contentItem.update({
      where: { id: current.id },
      data: { syncGroupId: groupId },
    });
    await getPrisma().contentPublishTarget.delete({ where: { id: target.id } });
    if (current.socialPageId === socialPageId) {
      const remaining = current.publishTargets.filter((t) => t.socialPageId !== socialPageId);
      await getPrisma().contentItem.update({
        where: { id: current.id },
        data: { socialPageId: remaining[0]?.socialPageId ?? null },
      });
    }
    await getPrisma().contentPublishTarget.deleteMany({ where: { contentItemId: newId_ } });
    await getPrisma().contentPublishTarget.create({
      data: {
        id: newId(),
        tenantId,
        contentItemId: newId_,
        socialPageId,
        publishState: 'NONE',
        publishAttempts: 0,
      },
    });
    await getPrisma().contentItem.update({
      where: { id: newId_ },
      data: {
        socialPageId,
        syncGroupId: null,
        channel: page?.network
          ? page.network.charAt(0).toUpperCase() + page.network.slice(1).toLowerCase()
          : current.channel,
      },
    });
    await syncContentPublishRollup(contentId);
    await syncContentPublishRollup(newId_);
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.detached',
      targetType: 'ContentItem',
      targetId: newId_,
      afterRef: contentId,
      correlationId,
    });
    const policy = await this.policyForBrand(tenantId, current.brandId);
    const row = await getPrisma().contentItem.findUniqueOrThrow({
      where: { id: newId_ },
      include: { publishTargets: true },
    });
    return { data: mapContent(row, policy), source_id: contentId };
  }

  /** Ungroup: one independent draft per publish target. */
  async ungroup(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: { publishTargets: true },
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const targets = current.publishTargets;
    if (targets.length <= 1) {
      await getPrisma().contentItem.update({
        where: { id: contentId },
        data: { syncGroupId: null },
      });
      const policy = await this.policyForBrand(tenantId, current.brandId);
      return { data: [mapContent(current, policy)] };
    }
    const created: string[] = [];
    const keep = targets[0]!;
    for (const t of targets.slice(1)) {
      const res = await this.detachPublishTarget(
        tenantId,
        actorUserId,
        contentId,
        t.socialPageId,
        correlationId,
      );
      created.push((res.data as { id: string }).id);
    }
    await getPrisma().contentItem.update({
      where: { id: contentId },
      data: { syncGroupId: null, socialPageId: keep.socialPageId },
    });
    await syncContentPublishRollup(contentId);
    const policy = await this.policyForBrand(tenantId, current.brandId);
    const rows = await getPrisma().contentItem.findMany({
      where: { id: { in: [contentId, ...created] } },
      include: { publishTargets: true },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.ungrouped',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
    });
    return { data: rows.map((r) => mapContent(r, policy)) };
  }

  /** Copy post to another brand (and optional social page). */
  async copyTo(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    input: { brandId: string; socialPageId?: string | null },
    correlationId?: string,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    await this.requireActiveBrand(tenantId, input.brandId);
    if (input.socialPageId) {
      const page = await getPrisma().socialPage.findFirst({
        where: {
          id: input.socialPageId,
          tenantId,
          brandId: input.brandId,
          status: { not: 'DISCONNECTED' },
        },
      });
      if (!page) throw new DomainError('NOT_FOUND', 'Social page not found', 404, 'errors.not_found');
    }
    const dup = await this.duplicate(tenantId, actorUserId, contentId, correlationId);
    const newId_ = (dup.data as { id: string }).id;
    const page = input.socialPageId
      ? await getPrisma().socialPage.findFirst({ where: { id: input.socialPageId } })
      : null;
    await getPrisma().contentItem.update({
      where: { id: newId_ },
      data: {
        brandId: input.brandId,
        campaignId: null,
        socialPageId: input.socialPageId ?? null,
        channel: page
          ? page.network.charAt(0).toUpperCase() + page.network.slice(1).toLowerCase()
          : current.channel,
      },
    });
    await getPrisma().contentPublishTarget.deleteMany({ where: { contentItemId: newId_ } });
    if (input.socialPageId) {
      await getPrisma().contentPublishTarget.create({
        data: {
          id: newId(),
          tenantId,
          contentItemId: newId_,
          socialPageId: input.socialPageId,
          publishState: 'NONE',
          publishAttempts: 0,
        },
      });
    }
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.copied_to',
      targetType: 'ContentItem',
      targetId: newId_,
      afterRef: contentId,
      correlationId,
    });
    const policy = await this.policyForBrand(tenantId, input.brandId);
    const row = await getPrisma().contentItem.findUniqueOrThrow({
      where: { id: newId_ },
      include: { publishTargets: true },
    });
    return { data: mapContent(row, policy) };
  }
}
