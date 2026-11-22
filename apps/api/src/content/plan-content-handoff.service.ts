import { getPrisma, tenantWhere } from '@oma/db';
import {
  deliverableHandoffChannel,
  deliverableHandoffContentType,
  deliverableHandoffMayUpdateExistingContent,
  newId,
  planDraftTrack,
  shouldCreatePlanContentDraft,
  type PlanWorkRequestDraft,
} from '@oma/domain';
import { brandTimezone } from '../brand/brand.service';
import { loadApprovalConfig } from './content-lock';
import { billingService } from '../billing/billing.service';
import type { AuditService } from '../audit/audit.service';

type PlanContentCtx = {
  tenantId: string;
  brandId: string;
  actorUserId: string;
  requestId: string;
  strategyId: string;
  strategyVersionId: string;
  correlationId?: string;
};

/**
 * Materialize a draft ContentItem from an approved strategy plan row (WorkRequest source).
 * Does not request or grant publish approval.
 */
export async function createStrategyPlanContentDraft(
  audit: AuditService,
  ctx: PlanContentCtx,
  draft: PlanWorkRequestDraft,
  defaults: { campaignId?: string | null; dueAt?: Date | null; targetKeyword?: string | null },
): Promise<{ contentId: string; created: boolean } | null> {
  if (!shouldCreatePlanContentDraft(draft)) return null;
  await billingService.assertWriteAccess(ctx.tenantId);

  const request = await getPrisma().workRequest.findFirst({
    where: tenantWhere(ctx.tenantId, { id: ctx.requestId, brandId: ctx.brandId }),
  });
  if (!request) return null;

  if (request.contentId) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(ctx.tenantId, { id: request.contentId }),
    });
    if (current) return { contentId: request.contentId, created: false };
  }

  const channel = deliverableHandoffChannel(draft.channels);
  const contentType = deliverableHandoffContentType(draft.formats);
  const track = planDraftTrack(draft);
  const campaignId = defaults.campaignId ?? request.campaignId ?? null;

  const { requiredApprovers } = await loadApprovalConfig(ctx.tenantId, ctx.brandId);
  const contentId = newId();
  await getPrisma().contentItem.create({
    data: {
      id: contentId,
      tenantId: ctx.tenantId,
      brandId: ctx.brandId,
      campaignId,
      titleEn: draft.title.en,
      titleAr: draft.title.ar,
      captionEn: draft.brief.keyMessage.en || null,
      captionAr: draft.brief.keyMessage.ar || null,
      contentType,
      channel,
      track,
      status: 'DRAFT',
      approvalState: 'NOT_REQUESTED',
      scheduleState: 'UNSCHEDULED',
      plannedAt: defaults.dueAt ?? request.dueAt ?? null,
      timezone: await brandTimezone(ctx.tenantId, ctx.brandId),
      approverRequired: requiredApprovers,
      approverApproved: 0,
      labels: ['strategy-plan', draft.plan_source_key, `strategy-version:${ctx.strategyVersionId}`],
      strategyVersionId: ctx.strategyVersionId,
      pillarKey: draft.pillar_key ?? null,
      targetKeyword: defaults.targetKeyword ?? null,
      createdBy: ctx.actorUserId,
    },
  });

  await getPrisma().workRequest.update({
    where: { id: ctx.requestId },
    data: { contentId },
  });

  await audit.write({
    actorUserId: ctx.actorUserId,
    tenantId: ctx.tenantId,
    action: 'content.strategy_plan_handoff.create',
    targetType: 'ContentItem',
    targetId: contentId,
    beforeRef: `${ctx.strategyId}:${ctx.strategyVersionId}`,
    afterRef: draft.plan_source_key,
    correlationId: ctx.correlationId,
  });

  return { contentId, created: true };
}

/**
 * Extra calendar slot for a pillar (DEC-029 4.2). The work request keeps its anchor
 * content; additional slots are separate DRAFT items labelled with the pillar.
 */
export async function createStrategyPlanSlotContent(
  audit: AuditService,
  ctx: PlanContentCtx,
  draft: PlanWorkRequestDraft,
  opts: {
    campaignId: string | null;
    plannedAt: Date;
    slot: { slot_key: string; pillar_key: string | null };
    targetKeyword?: string | null;
  },
): Promise<{ contentId: string }> {
  await billingService.assertWriteAccess(ctx.tenantId);
  const { requiredApprovers } = await loadApprovalConfig(ctx.tenantId, ctx.brandId);
  const contentId = newId();
  await getPrisma().contentItem.create({
    data: {
      id: contentId,
      tenantId: ctx.tenantId,
      brandId: ctx.brandId,
      campaignId: opts.campaignId,
      titleEn: draft.title.en,
      titleAr: draft.title.ar,
      captionEn: draft.brief.keyMessage.en || null,
      captionAr: draft.brief.keyMessage.ar || null,
      contentType: deliverableHandoffContentType(draft.formats),
      channel: deliverableHandoffChannel(draft.channels),
      track: planDraftTrack(draft),
      status: 'DRAFT',
      approvalState: 'NOT_REQUESTED',
      scheduleState: 'UNSCHEDULED',
      plannedAt: opts.plannedAt,
      timezone: await brandTimezone(ctx.tenantId, ctx.brandId),
      approverRequired: requiredApprovers,
      approverApproved: 0,
      labels: [
        'strategy-plan',
        draft.plan_source_key,
        `strategy-version:${ctx.strategyVersionId}`,
        `plan-slot:${opts.slot.slot_key}`,
        ...(opts.slot.pillar_key ? [`pillar:${opts.slot.pillar_key}`] : []),
      ],
      strategyVersionId: ctx.strategyVersionId,
      pillarKey: opts.slot.pillar_key ?? draft.pillar_key ?? null,
      targetKeyword: opts.targetKeyword ?? null,
      createdBy: ctx.actorUserId,
    },
  });
  await audit.write({
    actorUserId: ctx.actorUserId,
    tenantId: ctx.tenantId,
    action: 'content.strategy_plan_handoff.slot',
    targetType: 'ContentItem',
    targetId: contentId,
    beforeRef: `${ctx.strategyId}:${ctx.strategyVersionId}:${ctx.requestId}`,
    afterRef: `${draft.plan_source_key}:${opts.slot.slot_key}`,
    correlationId: ctx.correlationId,
  });
  return { contentId };
}

export async function refreshStrategyPlanContentFromDraft(
  audit: AuditService,
  ctx: PlanContentCtx,
  draft: PlanWorkRequestDraft,
  contentId: string,
): Promise<void> {
  const current = await getPrisma().contentItem.findFirst({
    where: tenantWhere(ctx.tenantId, { id: contentId }),
  });
  if (!current) return;
  if (
    !deliverableHandoffMayUpdateExistingContent({
      approvalState: current.approvalState,
      scheduleState: current.scheduleState,
      archivedAt: current.archivedAt,
    })
  ) {
    return;
  }

  await getPrisma().contentItem.update({
    where: { id: contentId },
    data: {
      titleEn: draft.title.en,
      titleAr: draft.title.ar,
      captionEn: draft.brief.keyMessage.en || null,
      captionAr: draft.brief.keyMessage.ar || null,
      channel: deliverableHandoffChannel(draft.channels),
      contentType: deliverableHandoffContentType(draft.formats),
      track: planDraftTrack(draft),
      labels: ['strategy-plan', draft.plan_source_key, `strategy-version:${ctx.strategyVersionId}`],
      updatedAt: new Date(),
    },
  });

  await audit.write({
    actorUserId: ctx.actorUserId,
    tenantId: ctx.tenantId,
    action: 'content.strategy_plan_handoff.refresh',
    targetType: 'ContentItem',
    targetId: contentId,
    beforeRef: ctx.requestId,
    afterRef: draft.plan_source_key,
    correlationId: ctx.correlationId,
  });
}
