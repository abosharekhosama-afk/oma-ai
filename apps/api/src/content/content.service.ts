import { Injectable } from '@nestjs/common';
import { getPrisma, Prisma, tenantWhere } from '@oma/db';
import { billingService } from '../billing/billing.service';
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
  parseApprovalMode,
  policyToApprovalMode,
  workspaceModeToPolicy,
  evaluateScheduleReadiness,
  evaluateMediaScheduleBlockers,
  mergeScheduleReadiness,
  scheduleRequiresConnectedAccount,
  calendarPlacement,
  aiReviewRequired,
  parseAiRunIds,
  applyAiOutput,
  aiProvenanceForCopy,
  parseReopenReason,
  readLevelPlan,
  evaluateLevelApproval,
  canDecideAtLevel,
  levelProgress,
  parseApprovalLevelsInput,
  type ApprovalDecisionKind,
  type ApprovalPolicy,
  type LockedContentField,
  type ReadinessTarget,
  type ScheduleReadiness,
  type ApprovalState,
  type ContentStatus,
  type ContentType,
  type Track,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { mediaPlaybackUrl } from '../media/media.service';
import { syncContentPublishRollup } from '../social/publish-target-sync';
import { buildChannelAnalyticsView, parseInsights } from './channel-analytics';
import { maybeRefreshPublishTargetInsights } from './refresh-post-insights';
import {
  levelsView,
  listApprovalLevels,
  planJson,
  replaceApprovalLevels,
  resolveLevelPlan,
} from './approval-levels';
import {
  enforceContentMutation,
  loadApprovalConfig,
  offScheduleData,
  resetPendingTargets,
  type ApprovalReset,
} from './content-lock';
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

type ContentRowForApproval = Prisma.ContentItemGetPayload<object>;

/** Level the round is waiting on (1-based); in counter mode, the next approval slot. */
function currentLevelPosition(row: { approverApproved: number; approverRequired: number }): number {
  return Math.max(1, Math.min(row.approverApproved + 1, row.approverRequired));
}

/**
 * In level mode, only someone who can decide at some level of the frozen plan may
 * request changes or reject during review (DEC-026). Counter mode is unchanged.
 */
function assertLevelDecider(
  row: { approvalLevels?: unknown; approvalState: string },
  actorUserId: string,
) {
  if (row.approvalState !== 'PENDING' && row.approvalState !== 'PARTIALLY_APPROVED') return;
  const plan = readLevelPlan(row.approvalLevels);
  if (!plan || plan.some((l) => canDecideAtLevel(l, actorUserId))) return;
  throw new DomainError(
    'APPROVAL_INELIGIBLE',
    'You are not an approver for this post',
    403,
    'error.approval_not_assigned',
  );
}

/** Compact level summary for cards and lists (DEC-026); null in counter mode. */
function approvalLevelsSummary(row: {
  approvalLevels?: unknown;
  approverApproved: number;
  approvalState: string;
}) {
  const plan = readLevelPlan(row.approvalLevels);
  if (!plan) return null;
  const done = row.approvalState === 'APPROVED' ? plan.length : row.approverApproved;
  const current = plan[done] ?? null;
  return {
    total: plan.length,
    completed: done,
    current: current
      ? { position: current.position, name: { en: current.nameEn, ar: current.nameAr } }
      : null,
  };
}

function withReset(reset: ApprovalReset | null): { approval_reset?: ApprovalReset } {
  return reset ? { approval_reset: reset } : {};
}

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
    aiAssisted?: boolean;
    aiRunIds?: string[];
    aiReviewedAt?: Date | null;
    aiReviewedBy?: string | null;
    approvalLevels?: unknown;
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
  const targets = readinessTargetsFromRow(row);
  const baseReadiness = targets
    ? evaluateScheduleReadiness({
        workflow: workflowSource(row),
        policy,
        channel: row.channel,
        targets,
        requireConnectedAccount: scheduleRequiresConnectedAccount(),
        ai: aiInput(row),
      })
    : null;
  const hasMedia =
    Boolean(row.previewAssetId) ||
    Boolean(row.previewAssetUrl) ||
    ((row as { mediaAssetIds?: string[] }).mediaAssetIds?.length ?? 0) > 0;
  const readiness = baseReadiness
    ? mergeScheduleReadiness(
        baseReadiness,
        hasMedia
          ? []
          : evaluateMediaScheduleBlockers({
              channel: row.channel,
              targets: targets ?? [],
              contentType: String(row.contentType),
              media: [],
            }),
      )
    : null;
  const calendar = calendarPlacement({
    status: row.status,
    scheduleState: row.scheduleState,
    plannedAt: row.plannedAt?.toISOString() ?? null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    readiness,
  });
  if (calendar.state === 'CANNOT_SCHEDULE') workflow.publishDisplay = 'CANNOT_SCHEDULE';
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
    approval_levels: approvalLevelsSummary(row),
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
    /** Live schedule blockers; null when the response was built without publish targets. */
    schedule_readiness: readiness,
    /** Planned vs Scheduled placement on the calendar (DEC-023). */
    calendar: { state: calendar.state, at: calendar.at },
    /** AI provenance + human-review gate (DEC-024). */
    ai: {
      assisted: Boolean(row.aiAssisted),
      run_ids: row.aiRunIds ?? [],
      reviewed_at: row.aiReviewedAt?.toISOString() ?? null,
      reviewed_by: row.aiReviewedBy ?? null,
      review_required: aiReviewRequired({
        aiAssisted: Boolean(row.aiAssisted),
        aiReviewedAt: row.aiReviewedAt ?? null,
      }),
    },
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
        (
          row as {
            publishTargets?: Array<{
              id: string;
              socialPageId: string;
              publishState: string;
              externalPostId?: string | null;
              externalPostUrl: string | null;
              lastPublishError: string | null;
              socialPage?: { network?: string } | null;
            }>;
          }
        ).publishTargets?.map((t) => ({
          id: t.id,
          social_page_id: t.socialPageId,
          network: t.socialPage?.network ? String(t.socialPage.network).toLowerCase() : undefined,
          state: t.publishState,
          external_post_id: t.externalPostId ?? null,
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

function aiInput(row: { aiAssisted?: boolean; aiReviewedAt?: Date | null }) {
  return { assisted: Boolean(row.aiAssisted), reviewed: Boolean(row.aiReviewedAt) };
}

/** Applied AI output must reference successful runs of this tenant (DEC-024). */
async function assertAiRunsUsable(tenantId: string, runIds: string[]) {
  const found = await getPrisma().aiRun.count({
    where: { tenantId, id: { in: runIds }, status: 'SUCCEEDED' },
  });
  if (found !== runIds.length) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'ai_run_ids must reference successful AI runs in this workspace',
      400,
      'errors.validation_failed',
      [{ field: 'ai_run_ids' }],
    );
  }
}

type TargetRowLike = {
  socialPageId: string;
  socialPage?: { network?: string | null; status?: string | null } | null;
};

/**
 * Readiness targets from an already-loaded row. Returns null when the row was
 * loaded without publish targets (or only has the legacy `socialPageId`), so
 * callers never report a blocker they did not check.
 */
function readinessTargetsFromRow(row: {
  socialPageId?: string | null;
  publishTargets?: TargetRowLike[];
}): ReadinessTarget[] | null {
  const rows = (row as { publishTargets?: TargetRowLike[] }).publishTargets;
  if (!rows) return null;
  if (!rows.length && row.socialPageId) return null;
  if (rows.some((t) => !t.socialPage?.status)) return null;
  return rows.map((t) => ({
    socialPageId: t.socialPageId,
    network: String(t.socialPage?.network ?? ''),
    status: String(t.socialPage?.status ?? ''),
  }));
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

export { workspaceModeToPolicy, effectiveApprovalPolicy, requiredApproverCount } from '@oma/domain';

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

const PREVIEW_STYLES = new Set(['default', 'classic', 'modern', 'compact']);

function parsePreviewStyle(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const style = value.trim().toLowerCase();
  if (!PREVIEW_STYLES.has(style)) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Unknown content style',
      400,
      'errors.validation_failed',
    );
  }
  return style;
}

function parseAccentColor(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const color = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Accent color must be #RRGGBB',
      400,
      'errors.validation_failed',
    );
  }
  return color.toLowerCase();
}

function calendarStateWhere(value: string | undefined) {
  if (value === undefined || value === '') return {};
  switch (value.toLowerCase()) {
    case 'planned':
      return { scheduleState: 'UNSCHEDULED' as const, plannedAt: { not: null } };
    case 'scheduled':
      return { scheduleState: 'SCHEDULED' as const };
    case 'unplanned':
      return { scheduleState: 'UNSCHEDULED' as const, plannedAt: null };
    default:
      throw new DomainError(
        'VALIDATION_FAILED',
        'calendar_state must be planned, scheduled or unplanned',
        400,
        'errors.validation_failed',
      );
  }
}

/** 409 SCHEDULE_BLOCKED with every blocker, so the UI can show what to fix. */
function assertScheduleReady(readiness: ScheduleReadiness, policy: ApprovalPolicy) {
  if (readiness.ready) return;
  throw new DomainError(
    'SCHEDULE_BLOCKED',
    `Scheduling is blocked: ${readiness.blockers.map((b) => b.code).join(', ')}`,
    409,
    'error.schedule_blocked',
    [{ policy, blockers: readiness.blockers }],
  );
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
  ): Promise<{
    mode: 'none' | 'optional' | 'required' | 'multi_level';
    policy: ApprovalPolicy;
    requiredApprovers: number;
    scheduleOnApproval: boolean;
    lockAfterApproval: boolean;
    reminderPendingApprovals: boolean;
    source: 'brand' | 'workspace';
  }> {
    return loadApprovalConfig(tenantId, brandId);
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
      /** planned | scheduled | unplanned (DEC-023). */
      calendarState?: string;
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
      ...calendarStateWhere(query.calendarState),
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
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
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
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
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

  /** Honest per-channel post analytics from stored or freshly fetched platform insights. */
  async channelAnalytics(tenantId: string, contentId: string, channel?: string, refresh = false) {
    const row = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: { publishTargets: { include: { socialPage: true } }, comments: true },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const channels = String(row.channel || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const requested =
      (channel || '').trim() ||
      channels[0] ||
      row.publishTargets[0]?.socialPage?.network ||
      'instagram';
    const wanted = requested.toLowerCase();
    const target = row.publishTargets.find((t) => {
      const net = String(t.socialPage?.network || '').toLowerCase();
      return (
        net === wanted ||
        wanted.includes(net) ||
        net.includes(wanted.replace('meta_', '')) ||
        (wanted.includes('instagram') && net.includes('instagram')) ||
        (wanted.includes('facebook') && net.includes('facebook')) ||
        (wanted.includes('tiktok') && net.includes('tiktok')) ||
        (wanted.includes('linkedin') && net.includes('linkedin')) ||
        (wanted.includes('whatsapp') && net.includes('whatsapp')) ||
        ((wanted === 'x' || wanted.includes('twitter')) && net === 'x')
      );
    });
    const comments = row.comments;
    let likes = 0;
    const rx = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
    for (const c of comments) {
      let map: Record<string, string[]> = {};
      try {
        map = c.reactionsJson ? (JSON.parse(c.reactionsJson) as Record<string, string[]>) : {};
      } catch {
        map = {};
      }
      for (const [emoji, users] of Object.entries(map)) {
        const n = users.length;
        likes += n;
        if (emoji === '👍') rx.like += n;
        else if (emoji === '❤️' || emoji === '😍') rx.love += n;
        else if (emoji === '😂' || emoji === '😀') rx.haha += n;
        else if (emoji === '😮') rx.wow += n;
        else if (emoji === '😢') rx.sad += n;
        else if (emoji === '😡') rx.angry += n;
      }
    }
    const publicComments = comments.filter((c) => !c.isInternal).length;
    const pageStatus = target?.socialPage?.status ?? null;
    const connected = Boolean(target?.socialPageId && pageStatus === 'CONNECTED');
    const isPublished = Boolean(
      target
        ? target.publishState === 'PUBLISHED' ||
            target.publishState === 'PUBLISHING' ||
            target.publishedAt
        : row.publishedAt || String(row.status) === 'PUBLISHED',
    );

    let insightsRaw = target?.insightsJson ?? null;
    let lastInsightsAt = target?.lastInsightsAt ?? null;
    if (refresh && target) {
      const updated = await maybeRefreshPublishTargetInsights(target);
      if (updated) {
        insightsRaw = updated.insightsJson;
        lastInsightsAt = updated.lastInsightsAt;
      }
    }
    const live = parseInsights(insightsRaw);

    return {
      data: buildChannelAnalyticsView({
        channel: requested,
        isPublished,
        publishedAt: target?.publishedAt || row.publishedAt || null,
        platformConnected: connected,
        pageStatus,
        externalPostId: target?.externalPostId ?? null,
        live,
        lastInsightsAt,
        omaLikes: likes,
        omaPublicComments: publicComments,
        omaCommentsTotal: comments.length,
        omaReactions: rx,
        approvals: row.approverApproved,
        contentId,
      }),
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
      /** AI runs whose output is in this post (DEC-024). */
      ai_run_ids?: string[] | null;
    },
    correlationId?: string,
  ) {
    await this.requireActiveBrand(tenantId, brandId);
    const aiRunIds = parseAiRunIds(input.ai_run_ids);
    if (aiRunIds) await assertAiRunsUsable(tenantId, aiRunIds);
    await billingService.assertWriteAccess(tenantId);
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
    const { policy, requiredApprovers } = await this.approvalConfig(tenantId, brandId);

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
        approverRequired: requiredApprovers,
        approverApproved: 0,
        labels: input.labels ?? [],
        ...(media ?? {}),
        ...(aiRunIds ? applyAiOutput({ aiRunIds: [] }, aiRunIds) : {}),
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
      ...(aiRunIds ? { afterRef: `ai_runs:${aiRunIds.join(',')}`.slice(0, 500) } : {}),
    });

    return { data: mapContent(row, policy) };
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
      ai_run_ids?: string[] | null;
    },
    correlationId?: string,
  ) {
    const aiRunIds = parseAiRunIds(patch.ai_run_ids);
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
    if (aiRunIds) await assertAiRunsUsable(tenantId, aiRunIds);

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

    const touched: LockedContentField[] = [];
    // Only real changes count, so re-saving an unchanged form never trips the lock.
    if (title && (title.en !== current.titleEn || title.ar !== current.titleAr)) {
      touched.push('title');
    }
    if (
      aiRunIds ||
      (caption && (caption.en !== current.captionEn || caption.ar !== current.captionAr))
    ) {
      touched.push('caption');
    }
    if (media && media.mediaAssetIds.join(',') !== (current.mediaAssetIds ?? []).join(',')) {
      touched.push('media');
    }
    if (patch.channel && patch.channel !== current.channel) touched.push('channel');
    // One gate for every publishable change (DEC-025); planning metadata is never locked.
    const approvalReset = await enforceContentMutation({
      tenantId,
      actorUserId,
      row: current,
      fields: touched,
      audit: this.audit,
      correlationId,
    });

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
        ...(aiRunIds ? applyAiOutput(current, aiRunIds) : {}),
      },
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.updated',
      targetType: 'ContentItem',
      targetId: row.id,
      correlationId,
      ...(aiRunIds ? { afterRef: `ai_runs:${aiRunIds.join(',')}`.slice(0, 500) } : {}),
    });

    const result = await this.get(tenantId, contentId);
    return { ...result, ...withReset(approvalReset) };
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
    const reqCfg = await this.approvalConfig(tenantId, current.brandId);
    const { policy: reqPolicy, requiredApprovers } = reqCfg;
    if (reqPolicy === 'NONE') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Approvals are turned off for this workspace',
        409,
        'error.approvals_disabled',
      );
    }
    let next;
    try {
      next = applyContentApprovalTransition({
        command: 'request_approval',
        approvalState: current.approvalState as ApprovalState,
        status: current.status as ContentStatus,
        approverApproved: current.approverApproved,
        approverRequired: current.approverRequired,
      });
    } catch {
      throw new DomainError(
        'CONFLICT_STATE',
        'Approval cannot be requested in the current state; edit the approved post first',
        409,
        'error.conflict_state',
      );
    }
    const levels = await resolveLevelPlan(tenantId, current.brandId, reqCfg);
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        approvalState: next.approvalState,
        status: next.status,
        approverRequired: levels ? levels.plan.length : requiredApprovers,
        approverApproved: 0,
        // Freeze the level plan for this round; settings edits never change it (DEC-026).
        approvalLevels: planJson(levels?.plan ?? null),
        approvalRoundStartedAt: new Date(),
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
      ...(levels ? { afterRef: `levels:${levels.plan.length};source:${levels.source}` } : {}),
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
    requestedLevel?: number | null,
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const plan = readLevelPlan(current.approvalLevels);
    const inRound =
      current.approvalState === 'PENDING' || current.approvalState === 'PARTIALLY_APPROVED';
    if (plan && inRound && current.approvalRoundStartedAt) {
      return this.approveLevel(
        tenantId,
        actorUserId,
        current,
        plan,
        current.approvalRoundStartedAt,
        note,
        correlationId,
        requestedLevel,
      );
    }
    if (current.approverRequired > 1) {
      // A new round starts at the last request or at an approval reset on edit (DEC-025).
      const lastRequest = await getPrisma().contentApprovalEvent.findFirst({
        where: { tenantId, contentId, action: { in: ['REQUEST', 'APPROVAL_RESET'] } },
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
    if (current.approvalRoundStartedAt) {
      await this.recordDecision(
        current,
        actorUserId,
        Math.min(current.approverApproved + 1, current.approverRequired),
        'APPROVED',
        note,
      );
    }
    return this.finishApproval(tenantId, actorUserId, current, next, approved, note, correlationId);
  }

  /** One approval at the current level of a frozen multi-level plan (DEC-026). */
  private async approveLevel(
    tenantId: string,
    actorUserId: string,
    current: ContentRowForApproval,
    plan: NonNullable<ReturnType<typeof readLevelPlan>>,
    roundStartedAt: Date,
    note: LocaleInput | undefined,
    correlationId: string | undefined,
    requestedLevel?: number | null,
  ) {
    const prisma = getPrisma();
    const decisions = await prisma.contentApprovalDecision.findMany({
      where: { contentId: current.id, roundStartedAt },
    });
    const outcome = evaluateLevelApproval({
      plan,
      completedLevels: current.approverApproved,
      decisions,
      actorUserId,
      requestedLevel,
    });
    try {
      await this.recordDecision(current, actorUserId, outcome.level.position, 'APPROVED', note, {
        createOnly: true,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DomainError(
          'CONFLICT_STATE',
          'You already approved this level; another approver is needed',
          409,
          'error.already_approved',
          [{ level: outcome.level.position }],
        );
      }
      throw err;
    }
    // Recount after the insert so concurrent approvals at one level still advance it.
    const approvals = await prisma.contentApprovalDecision.count({
      where: {
        contentId: current.id,
        roundStartedAt,
        levelPosition: outcome.level.position,
        decision: 'APPROVED',
      },
    });
    const levelComplete = approvals >= outcome.level.minApprovals;
    const completed = levelComplete ? outcome.level.position : current.approverApproved;
    const final = completed >= plan.length;
    const next = final
      ? { approvalState: 'APPROVED' as const, status: 'APPROVED' as const }
      : { approvalState: 'PARTIALLY_APPROVED' as const, status: 'IN_REVIEW' as const };
    return this.finishApproval(
      tenantId,
      actorUserId,
      current,
      next,
      completed,
      note,
      correlationId,
      {
        level: outcome.level.position,
        levelName: outcome.level.nameEn,
        approvals,
        required: outcome.level.minApprovals,
        levelComplete,
      },
    );
  }

  private async recordDecision(
    current: { id: string; tenantId: string; approvalRoundStartedAt: Date | null },
    actorUserId: string,
    levelPosition: number,
    decision: ApprovalDecisionKind,
    note?: LocaleInput,
    opts?: { createOnly?: boolean },
  ) {
    if (!current.approvalRoundStartedAt) return;
    const n = note ? localePair(note) : null;
    const key = {
      contentId: current.id,
      roundStartedAt: current.approvalRoundStartedAt,
      levelPosition: Math.max(1, levelPosition),
      approverUserId: actorUserId,
    };
    const data = { decision, noteEn: n?.en ?? null, noteAr: n?.ar ?? null, at: new Date() };
    if (opts?.createOnly) {
      await getPrisma().contentApprovalDecision.create({
        data: { id: newId(), tenantId: current.tenantId, ...key, ...data },
      });
      return;
    }
    await getPrisma().contentApprovalDecision.upsert({
      where: { contentId_roundStartedAt_levelPosition_approverUserId: key },
      create: { id: newId(), tenantId: current.tenantId, ...key, ...data },
      update: data,
    });
  }

  private async finishApproval(
    tenantId: string,
    actorUserId: string,
    current: ContentRowForApproval,
    next: { approvalState: ApprovalState; status: ContentStatus },
    approved: number,
    note: LocaleInput | undefined,
    correlationId: string | undefined,
    level?: {
      level: number;
      levelName: string;
      approvals: number;
      required: number;
      levelComplete: boolean;
    },
  ) {
    const contentId = current.id;
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        approvalState: next.approvalState,
        status: next.status,
        approverApproved: approved,
        // A completed human approval is also the AI review (DEC-024).
        ...(next.approvalState === 'APPROVED' && aiReviewRequired(current)
          ? { aiReviewedAt: new Date(), aiReviewedBy: actorUserId }
          : {}),
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
      ...(level
        ? {
            afterRef: `level:${level.level};approvals:${level.approvals}/${level.required}${level.levelComplete ? ';level_complete' : ''}`,
          }
        : {}),
    });
    if (next.approvalState === 'APPROVED') {
      const cfg = await this.approvalConfig(tenantId, current.brandId);
      const when = current.plannedAt ?? current.scheduledAt;
      if (cfg.scheduleOnApproval && when) {
        try {
          await this.schedule(
            tenantId,
            actorUserId,
            contentId,
            { scheduledAt: when.toISOString(), timezone: current.timezone },
            correlationId,
          );
          const scheduled = await getPrisma().contentItem.findUniqueOrThrow({
            where: { id: contentId },
          });
          const scheduledPolicy = await this.policyForBrand(tenantId, scheduled.brandId);
          return { data: mapContent(scheduled, scheduledPolicy) };
        } catch (err) {
          // Stay APPROVED; never swallow the reason silently (DEC-023).
          const blockers =
            err instanceof DomainError && err.code === 'SCHEDULE_BLOCKED'
              ? ((err.details?.[0] as { blockers?: Array<{ code: string }> } | undefined)
                  ?.blockers ?? [])
              : [];
          const reason = blockers.length
            ? blockers.map((b) => b.code).join(',')
            : err instanceof DomainError
              ? err.code
              : 'ERROR';
          await getPrisma().contentItem.update({
            where: { id: contentId },
            data: { lastPublishSkipReason: `Auto-schedule blocked: ${reason}` },
          });
          await this.audit.write({
            actorUserId,
            tenantId,
            action: 'content.schedule_on_approval_blocked',
            targetType: 'ContentItem',
            targetId: contentId,
            afterRef: reason.slice(0, 200),
            correlationId,
          });
          const policy = await this.policyForBrand(tenantId, row.brandId);
          return {
            data: mapContent(row, policy),
            auto_schedule: { attempted: true, scheduled: false, blockers },
          };
        }
      }
    }
    const policy = await this.policyForBrand(tenantId, row.brandId);
    return { data: mapContent(row, policy) };
  }

  /** Per-level approval progress for the stepper (DEC-026). */
  async approvalProgress(tenantId: string, contentId: string) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const plan = readLevelPlan(current.approvalLevels);
    const decisions = current.approvalRoundStartedAt
      ? await getPrisma().contentApprovalDecision.findMany({
          where: { contentId, roundStartedAt: current.approvalRoundStartedAt },
          orderBy: { at: 'asc' },
        })
      : [];
    const userIds = [...new Set(decisions.map((d) => d.approverUserId))];
    const users = userIds.length
      ? await getPrisma().user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    const decisionView = (d: (typeof decisions)[number]) => ({
      user_id: d.approverUserId,
      user_name: nameOf.get(d.approverUserId) ?? null,
      decision: d.decision,
      note: d.noteEn ? { en: d.noteEn, ar: d.noteAr ?? d.noteEn } : null,
      at: d.at.toISOString(),
    });
    const base = {
      approval_state: current.approvalState,
      round_started_at: current.approvalRoundStartedAt?.toISOString() ?? null,
      approver_required: current.approverRequired,
      approver_approved: current.approverApproved,
    };
    if (!plan) {
      return {
        data: {
          ...base,
          mode: 'counter' as const,
          levels: [],
          decisions: decisions.map(decisionView),
        },
      };
    }
    const progress = levelProgress({
      plan,
      completedLevels: current.approverApproved,
      approvalState: current.approvalState,
      decisions,
    });
    const view = await levelsView(tenantId, plan);
    return {
      data: {
        ...base,
        mode: 'levels' as const,
        levels: progress.map((l, i) => ({
          ...view[i]!,
          status: l.status,
          approvals: l.approvals,
          decisions: decisions.filter((d) => d.levelPosition === l.position).map(decisionView),
        })),
        decisions: decisions.map(decisionView),
      },
    };
  }

  async getApprovalLevels(tenantId: string, brandId: string | null) {
    if (brandId) await this.requireActiveBrand(tenantId, brandId);
    const [own, workspace, cfg] = await Promise.all([
      brandId ? listApprovalLevels(tenantId, brandId) : Promise.resolve(null),
      listApprovalLevels(tenantId, null),
      brandId ? this.approvalConfig(tenantId, brandId) : Promise.resolve(null),
    ]);
    const effective = cfg ? await resolveLevelPlan(tenantId, brandId!, cfg) : null;
    return {
      data: {
        levels: await levelsView(tenantId, own ?? workspace),
        ...(brandId
          ? {
              workspace_levels: await levelsView(tenantId, workspace),
              approval_mode: cfg!.mode,
              effective_source: effective?.source ?? 'counter',
            }
          : {}),
      },
    };
  }

  async setApprovalLevels(
    tenantId: string,
    actorUserId: string,
    brandId: string | null,
    body: unknown,
    correlationId?: string,
  ) {
    if (brandId) await this.requireActiveBrand(tenantId, brandId);
    const plan = parseApprovalLevelsInput(body);
    await replaceApprovalLevels({
      tenantId,
      brandId,
      plan,
      actorUserId,
      audit: this.audit,
      correlationId,
    });
    return this.getApprovalLevels(tenantId, brandId);
  }

  /**
   * Human confirmation that AI-assisted copy was reviewed (DEC-024). Works under every
   * approval policy, including NONE; the reviewer needs `content.approve`.
   */
  async confirmAiReview(
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
    if (current.archivedAt) {
      throw new DomainError('CONFLICT_STATE', 'Content is archived', 409, 'error.content_archived');
    }
    if (!current.aiAssisted) {
      throw new DomainError(
        'CONFLICT_STATE',
        'This post has no AI-generated copy to review',
        409,
        'error.ai_review_not_needed',
      );
    }
    if (current.aiReviewedAt) {
      throw new DomainError(
        'CONFLICT_STATE',
        'The AI-generated copy was already reviewed',
        409,
        'error.ai_review_already_done',
      );
    }
    const claimed = await getPrisma().contentItem.updateMany({
      where: { id: contentId, aiReviewedAt: null },
      data: { aiReviewedAt: new Date(), aiReviewedBy: actorUserId },
    });
    if (claimed.count !== 1) {
      throw new DomainError(
        'CONFLICT_STATE',
        'The AI-generated copy was already reviewed',
        409,
        'error.ai_review_already_done',
      );
    }
    await this.writeEvent(tenantId, contentId, actorUserId, 'AI_REVIEW', note);
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.ai_reviewed',
      targetType: 'ContentItem',
      targetId: contentId,
      afterRef: `ai_runs:${current.aiRunIds.join(',')}`.slice(0, 500),
      correlationId,
    });
    return this.get(tenantId, contentId);
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
    assertLevelDecider(current, actorUserId);
    // From APPROVED this is an explicit unlock (DEC-025): the post leaves the
    // publish schedule but stays Planned on the calendar.
    const unlock = current.approvalState === 'APPROVED';
    const unschedule = unlock && current.scheduleState === 'SCHEDULED';
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        approvalState: next.approvalState,
        status: next.status,
        approverApproved: 0,
        ...(unschedule ? offScheduleData(current) : {}),
      },
    });
    if (unschedule) await resetPendingTargets(current);
    if (!unlock) {
      await this.recordDecision(
        current,
        actorUserId,
        currentLevelPosition(current),
        'CHANGES_REQUESTED',
        note,
      );
    }
    await this.writeEvent(tenantId, contentId, actorUserId, 'REQUEST_CHANGES', note);
    if (unlock) {
      await this.audit.write({
        actorUserId,
        tenantId,
        action: 'content.unlocked',
        targetType: 'ContentItem',
        targetId: contentId,
        correlationId,
        afterRef: `via:request_changes${unschedule ? ';unscheduled' : ''}`,
      });
    }
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

  /**
   * Reopen approved content for editing (DEC-025). The only unlock path besides
   * request-changes: requires a reason, resets the approval round, takes the
   * post off the publish schedule (it stays Planned) and is fully audited.
   */
  async reopen(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    reasonInput: unknown,
    correlationId?: string,
  ) {
    const reason = parseReopenReason(reasonInput);
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    if (current.archivedAt) {
      throw new DomainError('CONFLICT_STATE', 'Content is archived', 409, 'error.conflict_state');
    }
    let next;
    try {
      next = applyContentApprovalTransition({
        command: 'reopen',
        approvalState: current.approvalState as ApprovalState,
        status: current.status as ContentStatus,
        approverApproved: current.approverApproved,
        approverRequired: current.approverRequired,
      });
    } catch {
      throw new DomainError(
        'CONFLICT_STATE',
        'Only approved content can be reopened',
        409,
        'error.reopen_not_approved',
      );
    }
    const unschedule = current.scheduleState === 'SCHEDULED';
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        approvalState: next.approvalState,
        status: next.status,
        approverApproved: 0,
        ...(unschedule ? offScheduleData(current) : {}),
      },
    });
    if (unschedule) await resetPendingTargets(current);
    await this.writeEvent(tenantId, contentId, actorUserId, 'REOPEN', reason);
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'content.unlocked',
      targetType: 'ContentItem',
      targetId: contentId,
      correlationId,
      afterRef: `via:reopen${unschedule ? ';unscheduled' : ''};reason:${reason}`.slice(0, 500),
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
    assertLevelDecider(current, actorUserId);
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: { approvalState: next.approvalState, status: next.status, approverApproved: 0 },
    });
    await this.recordDecision(
      current,
      actorUserId,
      currentLevelPosition(current),
      'REJECTED',
      note,
    );
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
    const samplePolicy = await this.policyForBrand(tenantId, current.brandId);
    assertCanPublish(workflowSource(current), samplePolicy);
    if (aiReviewRequired(current)) {
      assertScheduleReady(
        { ready: false, blockers: [{ code: 'AI_REVIEW_REQUIRED' }] },
        samplePolicy,
      );
    }
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

  /**
   * Readiness for a loaded row. Loads the legacy single `socialPageId` account when the
   * post has no publish-target rows, so the check never trusts an unloaded relation.
   */
  private async mediaAssetsForContent(
    tenantId: string,
    brandId: string,
    row: {
      previewAssetId: string | null;
      previewAssetUrl: string | null;
      mediaAssetIds?: string[];
      contentType: string;
    },
  ) {
    const ids = [
      ...(row.mediaAssetIds ?? []),
      ...(row.previewAssetId && !(row.mediaAssetIds ?? []).includes(row.previewAssetId)
        ? [row.previewAssetId]
        : []),
    ].filter(Boolean);
    if (!ids.length) {
      return row.previewAssetUrl ? [{ mime: 'image/jpeg' as const }] : [];
    }
    const assets = await getPrisma().mediaAsset.findMany({
      where: tenantWhere(tenantId, { id: { in: ids }, brandId }),
      select: { mime: true, size: true, width: true, height: true },
    });
    return assets.map((a) => ({
      mime: a.mime,
      sizeBytes: Number(a.size),
      width: a.width,
      height: a.height,
    }));
  }

  private async readinessFor(
    row: Parameters<typeof workflowSource>[0] & {
      tenantId: string;
      brandId: string;
      channel: string;
      socialPageId: string | null;
      publishTargets: TargetRowLike[];
      aiAssisted?: boolean;
      aiReviewedAt?: Date | null;
      previewAssetId: string | null;
      previewAssetUrl: string | null;
      mediaAssetIds?: string[];
      contentType: string;
    },
    policy: ApprovalPolicy,
  ): Promise<ScheduleReadiness> {
    let targets = readinessTargetsFromRow(row);
    if (!targets) {
      const page = row.socialPageId
        ? await getPrisma().socialPage.findFirst({
            where: { id: row.socialPageId, tenantId: row.tenantId, brandId: row.brandId },
            select: { id: true, network: true, status: true },
          })
        : null;
      targets = page
        ? [{ socialPageId: page.id, network: page.network, status: page.status }]
        : row.socialPageId
          ? [{ socialPageId: row.socialPageId, network: '', status: 'DISCONNECTED' }]
          : [];
    }
    const base = evaluateScheduleReadiness({
      workflow: workflowSource(row),
      policy,
      channel: row.channel,
      targets,
      requireConnectedAccount: scheduleRequiresConnectedAccount(),
      ai: aiInput(row),
    });
    const media = await this.mediaAssetsForContent(row.tenantId, row.brandId, row);
    return mergeScheduleReadiness(
      base,
      evaluateMediaScheduleBlockers({
        channel: row.channel,
        targets,
        contentType: String(row.contentType),
        media,
      }),
    );
  }

  /** GET /content/:id/schedule-readiness: every blocker, so the UI can show a checklist. */
  async scheduleReadiness(tenantId: string, contentId: string) {
    const row = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const policy = await this.policyForBrand(tenantId, row.brandId);
    const readiness = await this.readinessFor(row, policy);
    const calendar = calendarPlacement({
      status: row.status,
      scheduleState: row.scheduleState,
      plannedAt: row.plannedAt?.toISOString() ?? null,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      readiness,
    });
    return {
      data: {
        content_id: row.id,
        ready: readiness.ready,
        blockers: readiness.blockers,
        policy,
        require_connected_account: scheduleRequiresConnectedAccount(),
        calendar,
        targets: row.publishTargets.map((t) => ({
          social_page_id: t.socialPageId,
          network: t.socialPage?.network ? String(t.socialPage.network).toLowerCase() : null,
          status: t.socialPage?.status ?? null,
        })),
      },
    };
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
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const policy = await this.policyForBrand(tenantId, current.brandId);
    assertCanSchedule(workflowSource(current), policy);
    assertScheduleReady(await this.readinessFor(current, policy), policy);
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
    if (!current.scheduledAt) {
      await billingService.consumeUsage(tenantId, 'scheduled_posts_per_month', 1);
    }
    await getPrisma().contentItem.update({
      where: { id: contentId },
      data: {
        scheduledAt: when,
        scheduleState: 'SCHEDULED',
        status: 'SCHEDULED',
        timezone: tz,
        lastPublishSkipReason: null,
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
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
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
    return { data: mapContent(refreshed, policy) };
  }

  async enqueue(tenantId: string, actorUserId: string, contentId: string, correlationId?: string) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
    });
    if (!current) {
      throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    }
    const targets = await getPrisma().contentPublishTarget.findMany({
      where: { contentItemId: contentId },
      select: { socialPageId: true },
    });
    const { pickNextQueueSlot } = await import('../workspace/publish-queues.service');
    const slot = await pickNextQueueSlot(tenantId, {
      brandId: current.brandId,
      socialPageIds: targets.map((t) => t.socialPageId),
    });
    if (!slot) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'No free queue slot in the next three weeks',
        400,
        'errors.validation_failed',
      );
    }
    return this.schedule(
      tenantId,
      actorUserId,
      contentId,
      { scheduledAt: slot.at.toISOString(), timezone: slot.timezone },
      correlationId,
    );
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
        // Unscheduling keeps the post on the calendar as Planned (DEC-023).
        plannedAt: current.plannedAt ?? current.scheduledAt,
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
        ...aiProvenanceForCopy(current),
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
        // Effective settings: explicit brand override when set, otherwise the workspace defaults.
        approval_policy: effective.policy,
        approval_mode: effective.mode,
        approval_policy_source: effective.source,
        required_approvers: effective.requiredApprovers,
        schedule_on_approval: effective.scheduleOnApproval,
        lock_after_approval: effective.lockAfterApproval,
        reminder_pending_approvals: effective.reminderPendingApprovals,
        default_timezone: prefs?.defaultTimezone ?? 'Asia/Dubai',
        preview_style: prefs?.previewStyle ?? 'default',
        accent_color: prefs?.accentColor ?? null,
      },
    };
  }

  async updatePreferences(
    tenantId: string,
    brandId: string,
    patch: {
      approvalPolicy?: ApprovalPolicy | null;
      approvalMode?: string | null;
      requiredApprovers?: number;
      scheduleOnApproval?: boolean;
      lockAfterApproval?: boolean;
      reminderPendingApprovals?: boolean;
      defaultTimezone?: string;
      previewStyle?: string;
      accentColor?: string | null;
    },
  ) {
    await this.requireActiveBrand(tenantId, brandId);
    if (patch.defaultTimezone !== undefined)
      patch.defaultTimezone = parseTimezone(patch.defaultTimezone);
    const previewStyle = parsePreviewStyle(patch.previewStyle);
    const accentColor = parseAccentColor(patch.accentColor);
    let approvalMode = parseApprovalMode(patch.approvalMode);
    if (patch.approvalMode !== undefined && patch.approvalMode !== null && !approvalMode) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Invalid approvalMode',
        400,
        'errors.validation_failed',
        [{ field: 'approvalMode' }],
      );
    }
    if (!approvalMode && patch.approvalPolicy) {
      approvalMode = policyToApprovalMode(patch.approvalPolicy);
    }
    const approvalPolicy = approvalMode
      ? workspaceModeToPolicy(approvalMode)
      : patch.approvalPolicy === undefined
        ? undefined
        : patch.approvalPolicy;
    const requiredApprovers =
      approvalMode && patch.requiredApprovers !== undefined
        ? approvalMode === 'multi_level'
          ? Math.min(5, Math.max(2, patch.requiredApprovers))
          : approvalMode === 'required'
            ? Math.min(5, Math.max(1, patch.requiredApprovers))
            : 1
        : patch.requiredApprovers;
    const row = await getPrisma().contentPreferences.upsert({
      where: { brandId },
      create: {
        brandId,
        tenantId,
        approvalPolicy: approvalPolicy ?? null,
        approvalMode: approvalMode ?? null,
        requiredApprovers: requiredApprovers ?? null,
        scheduleOnApproval: patch.scheduleOnApproval ?? null,
        lockAfterApproval: patch.lockAfterApproval ?? null,
        reminderPendingApprovals: patch.reminderPendingApprovals ?? null,
        defaultTimezone: patch.defaultTimezone ?? 'Asia/Dubai',
        previewStyle: previewStyle ?? 'default',
        accentColor: accentColor === undefined ? null : accentColor,
      },
      update: {
        ...(approvalPolicy !== undefined ? { approvalPolicy } : {}),
        ...(patch.approvalMode !== undefined || patch.approvalPolicy !== undefined
          ? { approvalMode: approvalMode ?? null }
          : {}),
        ...(requiredApprovers !== undefined ? { requiredApprovers } : {}),
        ...(patch.scheduleOnApproval !== undefined
          ? { scheduleOnApproval: patch.scheduleOnApproval }
          : {}),
        ...(patch.lockAfterApproval !== undefined
          ? { lockAfterApproval: patch.lockAfterApproval }
          : {}),
        ...(patch.reminderPendingApprovals !== undefined
          ? { reminderPendingApprovals: patch.reminderPendingApprovals }
          : {}),
        ...(patch.defaultTimezone ? { defaultTimezone: patch.defaultTimezone } : {}),
        ...(previewStyle ? { previewStyle } : {}),
        ...(accentColor !== undefined ? { accentColor } : {}),
      },
    });
    const effective = await this.approvalConfig(tenantId, brandId);
    return {
      data: {
        brand_id: brandId,
        approval_policy: effective.policy,
        approval_mode: effective.mode,
        approval_policy_source: effective.source,
        required_approvers: effective.requiredApprovers,
        schedule_on_approval: effective.scheduleOnApproval,
        lock_after_approval: effective.lockAfterApproval,
        reminder_pending_approvals: effective.reminderPendingApprovals,
        default_timezone: row.defaultTimezone,
        preview_style: row.previewStyle,
        accent_color: row.accentColor,
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
      if (!parent)
        throw new DomainError('NOT_FOUND', 'Parent comment not found', 404, 'errors.not_found');
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
      const admin = await getPrisma().capabilityGrant.findFirst({
        where: {
          tenantId,
          capabilityCode: 'tenant.manage',
          revokedAt: null,
          membership: { userId: actorUserId, status: 'ACTIVE' },
        },
        select: { id: true },
      });
      if (!admin) {
        throw new DomainError(
          'PERMISSION_DENIED',
          'Only the author can edit this comment',
          403,
          'errors.permission_denied',
        );
      }
    }
    const pair = localePair(body);
    if (!pair.en.trim()) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Comment body required',
        400,
        'errors.validation_failed',
      );
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
    await billingService.assertFeature(tenantId, 'publishing');
    const { enqueuePublishTargetsNow } = await import('../social/enqueue-publish-now');
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
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
    // Publish-now is scheduling for "now": the same readiness gate applies (DEC-023).
    assertScheduleReady(await this.readinessFor(current, policy), policy);
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
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
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
    await this.requireActiveBrand(tenantId, current.brandId);
    const nextAudience = audience?.trim() || null;
    const approvalReset = await enforceContentMutation({
      tenantId,
      actorUserId,
      row: current,
      fields: nextAudience !== current.preferredAudience ? ['preferred_audience'] : [],
      audit: this.audit,
      correlationId,
    });
    const row = await getPrisma().contentItem.update({
      where: { id: contentId },
      data: { preferredAudience: nextAudience },
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
    return { data: mapContent(row, policy), ...withReset(approvalReset) };
  }

  /** Detach one social page into its own post (Planable detach from group). */
  async detachPublishTarget(
    tenantId: string,
    actorUserId: string,
    contentId: string,
    socialPageId: string,
    correlationId?: string,
    opts?: { skipLockCheck?: boolean },
  ) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Content not found', 404, 'errors.not_found');
    const target = current.publishTargets.find((t) => t.socialPageId === socialPageId);
    if (!target)
      throw new DomainError('NOT_FOUND', 'Publish target not found', 404, 'errors.not_found');
    if (current.publishTargets.length <= 1) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Cannot detach the only channel from this post',
        409,
        'error.conflict_state',
      );
    }
    // Detaching changes where the source post publishes (DEC-025).
    if (!opts?.skipLockCheck) {
      await enforceContentMutation({
        tenantId,
        actorUserId,
        row: current,
        fields: ['publish_targets', 'sync_group'],
        audit: this.audit,
        correlationId,
      });
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
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
    });
    return { data: mapContent(row, policy), source_id: contentId };
  }

  /** Ungroup: one independent draft per publish target. */
  async ungroup(tenantId: string, actorUserId: string, contentId: string, correlationId?: string) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(tenantId, { id: contentId }),
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
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
    await enforceContentMutation({
      tenantId,
      actorUserId,
      row: current,
      fields: ['publish_targets', 'sync_group'],
      audit: this.audit,
      correlationId,
    });
    const created: string[] = [];
    const keep = targets[0]!;
    for (const t of targets.slice(1)) {
      const res = await this.detachPublishTarget(
        tenantId,
        actorUserId,
        contentId,
        t.socialPageId,
        correlationId,
        { skipLockCheck: true },
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
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
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
      if (!page)
        throw new DomainError('NOT_FOUND', 'Social page not found', 404, 'errors.not_found');
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
      include: {
        publishTargets: { include: { socialPage: { select: { network: true, status: true } } } },
      },
    });
    return { data: mapContent(row, policy) };
  }
}
