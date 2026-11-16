import { getPrisma } from '@oma/db';
import {
  contentLockedError,
  newId,
  decideContentMutation,
  resolveApprovalSettings,
  type ApprovalPolicy,
  type LockedContentField,
  type ResolvedApprovalSettings,
} from '@oma/domain';
import type { AuditService } from '../audit/audit.service';
import { syncContentPublishRollup } from '../social/publish-target-sync';

/** Effective approval settings for a brand (brand override, else workspace). */
export async function loadApprovalConfig(
  tenantId: string,
  brandId: string,
): Promise<ResolvedApprovalSettings> {
  const prisma = getPrisma();
  const [prefs, ws] = await Promise.all([
    prisma.contentPreferences.findUnique({ where: { brandId } }),
    prisma.workspaceSetting.findUnique({ where: { tenantId } }).catch(() => null),
  ]);
  const brand =
    prefs && prefs.tenantId === tenantId
      ? {
          approvalMode: prefs.approvalMode,
          approvalPolicy: prefs.approvalPolicy as ApprovalPolicy | null,
          requiredApprovers: prefs.requiredApprovers,
          scheduleOnApproval: prefs.scheduleOnApproval,
          lockAfterApproval: prefs.lockAfterApproval,
          reminderPendingApprovals: prefs.reminderPendingApprovals,
        }
      : null;
  return resolveApprovalSettings(
    {
      approvalMode: ws?.approvalMode,
      requiredApprovers: ws?.requiredApprovers,
      scheduleOnApproval: ws?.scheduleOnApproval,
      lockAfterApproval: ws?.lockAfterApproval,
      reminderPendingApprovals: ws?.reminderPendingApprovals,
    },
    brand,
  );
}

export type LockableRow = {
  id: string;
  brandId: string;
  approvalState: string;
  approverApproved: number;
  status: string;
  scheduleState: string;
  scheduledAt: Date | null;
  plannedAt: Date | null;
  publishState: string;
};

export type ApprovalReset = {
  from: 'APPROVED' | 'PARTIALLY_APPROVED';
  fields: LockedContentField[];
  unscheduled: boolean;
};

/**
 * Prisma data that takes a post off the publish schedule but keeps it on the
 * calendar as Planned (DEC-023). Caller must also call `resetPendingTargets`.
 */
export function offScheduleData(row: LockableRow) {
  return {
    scheduleState: 'UNSCHEDULED' as const,
    scheduledAt: null,
    plannedAt: row.plannedAt ?? row.scheduledAt,
    ...(row.publishState === 'ALL_SUCCEEDED'
      ? {}
      : { publishState: 'NONE' as const, nextPublishAt: null }),
  };
}

export async function resetPendingTargets(row: LockableRow) {
  if (row.publishState === 'ALL_SUCCEEDED') return;
  await getPrisma().contentPublishTarget.updateMany({
    where: { contentItemId: row.id, publishState: { not: 'PUBLISHED' } },
    data: { publishState: 'NONE', nextPublishAt: null },
  });
  await syncContentPublishRollup(row.id);
}

const RESET_NOTE = {
  APPROVED: {
    en: 'Approval reset: the approved post was edited',
    ar: 'أُعيد ضبط الاعتماد: تم تعديل المنشور المعتمد',
  },
  PARTIALLY_APPROVED: {
    en: 'Approvals restarted: the post changed during review',
    ar: 'أُعيدت الموافقات من البداية: تغيّر المنشور أثناء المراجعة',
  },
} as const;

/**
 * The single server-side gate for every path that changes what a post publishes
 * (DEC-025). Throws 409 `error.content_locked` when locked; otherwise applies
 * the approval reset (event + audit) before the caller writes its change.
 */
export async function enforceContentMutation(opts: {
  tenantId: string;
  actorUserId: string;
  row: LockableRow;
  fields: readonly LockedContentField[];
  audit: AuditService;
  correlationId?: string;
}): Promise<ApprovalReset | null> {
  const { tenantId, actorUserId, row, fields, audit, correlationId } = opts;
  if (!fields.length) return null;
  const cfg = await loadApprovalConfig(tenantId, row.brandId);
  const decision = decideContentMutation(
    {
      approvalState: row.approvalState,
      approverApproved: row.approverApproved,
      policy: cfg.policy,
      lockAfterApproval: cfg.lockAfterApproval,
    },
    fields,
  );
  if (decision.kind === 'allow') return null;
  if (decision.kind === 'locked') throw contentLockedError(decision.fields);

  const unschedule = decision.unschedule && row.scheduleState === 'SCHEDULED';
  await getPrisma().contentItem.update({
    where: { id: row.id },
    data: {
      ...decision.data,
      status: decision.from === 'APPROVED' ? 'DRAFT' : 'IN_REVIEW',
      ...(unschedule ? offScheduleData(row) : {}),
    },
  });
  if (unschedule) await resetPendingTargets(row);
  const note = RESET_NOTE[decision.from];
  await getPrisma().contentApprovalEvent.create({
    data: {
      id: newId(),
      tenantId,
      contentId: row.id,
      actorUserId,
      action: 'APPROVAL_RESET',
      noteEn: note.en,
      noteAr: note.ar,
    },
  });
  await audit.write({
    actorUserId,
    tenantId,
    action: 'content.approval_reset_on_edit',
    targetType: 'ContentItem',
    targetId: row.id,
    correlationId,
    afterRef: `from:${decision.from};fields:${decision.fields.join(',')}${unschedule ? ';unscheduled' : ''}`,
  });
  return { from: decision.from, fields: decision.fields, unscheduled: unschedule };
}
