import { getPrisma, tenantWhere } from '@oma/db';
import {
  deliverableHandoffChannel,
  deliverableHandoffContentType,
  deliverableHandoffMayUpdateExistingContent,
  newId,
  shouldHandoffDeliverableToContent,
  type ContentType,
  type Track,
} from '@oma/domain';
import { brandTimezone } from '../brand/brand.service';
import { loadApprovalConfig } from './content-lock';
import { billingService } from '../billing/billing.service';
import { mediaPlaybackUrl } from '../media/media.service';
import type { AuditService } from '../audit/audit.service';

type HandoffContext = {
  tenantId: string;
  actorUserId: string;
  deliverableId: string;
  correlationId?: string;
};

async function loadHandoffContext(tenantId: string, deliverableId: string, approvedVersionId: string) {
  const deliverable = await getPrisma().workDeliverable.findFirst({
    where: tenantWhere(tenantId, { id: deliverableId }),
  });
  if (!deliverable) return null;
  const [task, request, version] = await Promise.all([
    deliverable.taskId
      ? getPrisma().workTask.findFirst({
          where: tenantWhere(tenantId, { id: deliverable.taskId }),
        })
      : Promise.resolve(null),
    deliverable.requestId
      ? getPrisma().workRequest.findFirst({
          where: tenantWhere(tenantId, { id: deliverable.requestId }),
        })
      : Promise.resolve(null),
    getPrisma().workDeliverableVersion.findFirst({
      where: tenantWhere(tenantId, { id: approvedVersionId, deliverableId }),
    }),
  ]);
  return { deliverable, task, request, version };
}

async function resolvePostMedia(
  tenantId: string,
  brandId: string,
  version: { assetId: string | null; assetUrl: string | null } | null,
  deliverable: { assetId: string | null; assetUrl: string | null },
) {
  const assetId = version?.assetId ?? deliverable.assetId;
  if (!assetId) {
    const url = version?.assetUrl ?? deliverable.assetUrl;
    return url ? { previewAssetId: null, previewAssetUrl: url, mediaAssetIds: [] as string[] } : {};
  }
  const asset = await getPrisma().mediaAsset.findFirst({
    where: tenantWhere(tenantId, {
      id: assetId,
      brandId,
      kind: { in: ['posts', 'deliverables'] },
    }),
    select: { id: true, mime: true, kind: true },
  });
  if (!asset) {
    const url = version?.assetUrl ?? deliverable.assetUrl;
    return url ? { previewAssetId: null, previewAssetUrl: url, mediaAssetIds: [] as string[] } : {};
  }
  return {
    previewAssetId: asset.id,
    previewAssetUrl: mediaPlaybackUrl(asset.id, asset.mime),
    mediaAssetIds: [asset.id],
  };
}

async function propagateContentId(
  tenantId: string,
  contentId: string,
  deliverable: { id: string; taskId: string | null; requestId: string | null },
) {
  await getPrisma().workDeliverable.updateMany({
    where: { id: deliverable.id, tenantId },
    data: { contentId },
  });
  if (deliverable.taskId) {
    await getPrisma().workTask.updateMany({
      where: { id: deliverable.taskId, tenantId, contentId: null },
      data: { contentId },
    });
  }
  if (deliverable.requestId) {
    await getPrisma().workRequest.updateMany({
      where: { id: deliverable.requestId, tenantId, contentId: null },
      data: { contentId },
    });
  }
}

/**
 * After deliverable approval: create or refresh a draft ContentItem and link contentId.
 * Never advances content approval or scheduling — publishing still requires explicit user approval.
 */
export async function handoffApprovedDeliverableToContent(
  audit: AuditService,
  ctx: HandoffContext,
  approvedVersionId: string,
): Promise<{ contentId: string | null; created: boolean }> {
  const bundle = await loadHandoffContext(ctx.tenantId, ctx.deliverableId, approvedVersionId);
  if (!bundle) return { contentId: null, created: false };
  const { deliverable, task, request, version } = bundle;

  if (
    !shouldHandoffDeliverableToContent({
      requestType: request?.type ?? 'CONTENT',
      channels: request?.channels ?? [],
    })
  ) {
    return { contentId: deliverable.contentId, created: false };
  }

  await billingService.assertWriteAccess(ctx.tenantId);

  const existingContentId =
    deliverable.contentId ?? task?.contentId ?? request?.contentId ?? null;
  const media = await resolvePostMedia(ctx.tenantId, deliverable.brandId, version, deliverable);
  const channel = deliverableHandoffChannel(request?.channels);
  const contentType: ContentType = deliverableHandoffContentType(request?.formats);
  let track: Track = 'ORGANIC';
  const campaignId = deliverable.campaignId ?? task?.campaignId ?? request?.campaignId ?? null;
  if (campaignId) {
    const campaign = await getPrisma().campaign.findFirst({
      where: tenantWhere(ctx.tenantId, { id: campaignId, brandId: deliverable.brandId }),
    });
    if (campaign && !campaign.archivedAt) track = campaign.track as Track;
  }

  const captionEn =
    request?.briefKeyMessageEn?.trim() ||
    task?.descriptionEn?.trim() ||
    deliverable.titleEn ||
    '';
  const captionAr =
    request?.briefKeyMessageAr?.trim() ||
    task?.descriptionAr?.trim() ||
    deliverable.titleAr ||
    captionEn;

  if (existingContentId) {
    const current = await getPrisma().contentItem.findFirst({
      where: tenantWhere(ctx.tenantId, { id: existingContentId }),
    });
    if (current) {
      if (
        deliverableHandoffMayUpdateExistingContent({
          approvalState: current.approvalState,
          scheduleState: current.scheduleState,
          archivedAt: current.archivedAt,
        }) &&
        Object.keys(media).length > 0
      ) {
        await getPrisma().contentItem.update({
          where: { id: current.id },
          data: {
            ...media,
            updatedAt: new Date(),
          },
        });
        await audit.write({
          actorUserId: ctx.actorUserId,
          tenantId: ctx.tenantId,
          action: 'content.deliverable_handoff.refresh',
          targetType: 'ContentItem',
          targetId: current.id,
          beforeRef: ctx.deliverableId,
          afterRef: approvedVersionId,
          correlationId: ctx.correlationId,
        });
      }
      await propagateContentId(ctx.tenantId, existingContentId, deliverable);
      return { contentId: existingContentId, created: false };
    }
  }

  const { requiredApprovers } = await loadApprovalConfig(ctx.tenantId, deliverable.brandId);
  const contentId = newId();
  await getPrisma().contentItem.create({
    data: {
      id: contentId,
      tenantId: ctx.tenantId,
      brandId: deliverable.brandId,
      campaignId,
      titleEn: deliverable.titleEn,
      titleAr: deliverable.titleAr,
      captionEn: captionEn || null,
      captionAr: captionAr || null,
      contentType,
      channel,
      track,
      status: 'DRAFT',
      approvalState: 'NOT_REQUESTED',
      scheduleState: 'UNSCHEDULED',
      plannedAt: task?.dueAt ?? request?.dueAt ?? null,
      timezone: await brandTimezone(ctx.tenantId, deliverable.brandId),
      approverRequired: requiredApprovers,
      approverApproved: 0,
      labels: ['deliverable-handoff'],
      ...media,
      createdBy: ctx.actorUserId,
    },
  });

  await propagateContentId(ctx.tenantId, contentId, deliverable);
  await audit.write({
    actorUserId: ctx.actorUserId,
    tenantId: ctx.tenantId,
    action: 'content.deliverable_handoff.create',
    targetType: 'ContentItem',
    targetId: contentId,
    beforeRef: ctx.deliverableId,
    afterRef: approvedVersionId,
    correlationId: ctx.correlationId,
  });

  return { contentId, created: true };
}