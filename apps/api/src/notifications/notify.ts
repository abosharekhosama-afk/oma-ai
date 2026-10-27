import { getPrisma, tenantWhere } from '@oma/db';
import { newId, notificationAllowed } from '@oma/domain';
import { createLogger } from '@oma/observability';

const log = createLogger('notify');

/** Notification types users can toggle in preferences (all default ON). */
export const NOTIFICATION_TYPES = [
  'content.approval_requested',
  'content.approved',
  'content.changes_requested',
  'content.rejected',
  'content.comment',
  'deliverable.review',
  'deliverable.approved',
  'deliverable.changes_requested',
  'deliverable.rejected',
  'deliverable.comment',
  'task.assigned',
  'task.comment',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Audit action → notification type, for actions notified via the audit hook. */
const AUDIT_TO_TYPE: Record<string, NotificationType> = {
  'content.approval_requested': 'content.approval_requested',
  'content.approved': 'content.approved',
  'content.changes_requested': 'content.changes_requested',
  'content.rejected': 'content.rejected',
  'content.comment_added': 'content.comment',
  'deliverable.review.submit': 'deliverable.review',
  'deliverable.review.approve': 'deliverable.approved',
  'deliverable.review.request_changes': 'deliverable.changes_requested',
  'deliverable.review.reject': 'deliverable.rejected',
};

export function notificationTypeForAudit(action: string): NotificationType | null {
  return AUDIT_TO_TYPE[action] ?? null;
}

export function parsePreferences(raw: string | null | undefined): Record<string, unknown> {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A user opted out when preferences.notifications[type] === false (or all muted). */
export function wantsNotification(prefsJson: string | null | undefined, type: string): boolean {
  return notificationAllowed(prefsJson, type);
}

async function membersWithCaps(tenantId: string, caps: string[]): Promise<string[]> {
  const rows = await getPrisma().membership.findMany({
    where: tenantWhere(tenantId, {
      status: 'ACTIVE',
      grants: { some: { revokedAt: null, capabilityCode: { in: caps } } },
    }),
    select: { userId: true },
  });
  return rows.map((r) => r.userId).filter((x): x is string => Boolean(x));
}

/**
 * Decision outcomes worth keeping in the inbox even when you made them yourself — only used for
 * single-member workspaces so a solo owner still gets a trail of approvals/rejections, without
 * pinging themselves for requests, comments or assignments they just performed.
 */
export const SOLO_SELF_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'content.approved',
  'content.changes_requested',
  'content.rejected',
  'deliverable.approved',
  'deliverable.changes_requested',
  'deliverable.rejected',
]);

/** Pure recipient resolution (unit-tested). */
export function resolveRecipients(input: {
  recipients: Array<string | null | undefined>;
  actorUserId?: string | null;
  type: NotificationType;
  activeMemberCount: number;
}): string[] {
  const unique = [...new Set(input.recipients.filter((x): x is string => Boolean(x)))];
  const others = unique.filter((id) => id !== input.actorUserId);
  if (others.length) return others;
  if (input.actorUserId && input.activeMemberCount === 1 && SOLO_SELF_TYPES.has(input.type)) {
    return [input.actorUserId];
  }
  return [];
}

/** Insert notifications for recipients (minus actor, minus opted-out, active members only). */
export async function deliverNotifications(input: {
  tenantId: string;
  actorUserId?: string | null;
  type: NotificationType;
  recipients: Array<string | null | undefined>;
  objectType: string;
  objectId: string;
  deepLinkPath: string;
}): Promise<number> {
  const prisma = getPrisma();
  const othersExist = input.recipients.some((r) => r && r !== input.actorUserId);
  const activeMemberCount = othersExist
    ? 2
    : (
        await prisma.membership.findMany({
          where: tenantWhere(input.tenantId, { status: 'ACTIVE', userId: { not: null } }),
          select: { userId: true },
          distinct: ['userId'],
          take: 2,
        })
      ).length;
  const ids = resolveRecipients({
    recipients: input.actorUserId ? [...input.recipients, input.actorUserId] : input.recipients,
    actorUserId: input.actorUserId,
    type: input.type,
    activeMemberCount,
  });
  if (!ids.length) return 0;
  const active = await prisma.membership.findMany({
    where: tenantWhere(input.tenantId, { status: 'ACTIVE', userId: { in: ids } }),
    select: { userId: true },
  });
  const activeIds = [...new Set(active.map((m) => m.userId).filter(Boolean) as string[])];
  if (!activeIds.length) return 0;
  const users = await prisma.user.findMany({
    where: { id: { in: activeIds } },
    select: { id: true, preferencesJson: true },
  });
  const targets = users.filter((u) => wantsNotification(u.preferencesJson, input.type));
  if (!targets.length) return 0;
  const res = await prisma.notification.createMany({
    data: targets.map((u) => ({
      id: newId(),
      tenantId: input.tenantId,
      recipientUserId: u.id,
      type: input.type,
      objectType: input.objectType,
      objectId: input.objectId,
      deepLinkPath: input.deepLinkPath,
      dedupeKey: `${input.type}:${input.objectId}:${u.id}:${newId()}`,
    })),
    skipDuplicates: true,
  });
  return res.count;
}

/** Called after an audit event is written; never throws. */
export async function notifyFromAudit(evt: {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
}): Promise<void> {
  const type = notificationTypeForAudit(evt.action);
  if (!type || !evt.tenantId || !evt.targetId) return;
  try {
    const prisma = getPrisma();
    if (evt.targetType === 'ContentItem') {
      const item = await prisma.contentItem.findFirst({
        where: tenantWhere(evt.tenantId, { id: evt.targetId }),
        select: { id: true, createdBy: true, assigneeUserId: true },
      });
      if (!item) return;
      let recipients: Array<string | null> = [item.createdBy, item.assigneeUserId];
      if (type === 'content.approval_requested') {
        recipients = recipients.concat(await membersWithCaps(evt.tenantId, ['content.approve']));
      }
      if (type === 'content.comment') {
        const prior = await prisma.contentComment.findMany({
          where: { tenantId: evt.tenantId, contentId: item.id },
          select: { authorUserId: true },
          take: 50,
        });
        recipients = recipients.concat(prior.map((p) => p.authorUserId));
      }
      await deliverNotifications({
        tenantId: evt.tenantId,
        actorUserId: evt.actorUserId,
        type,
        recipients,
        objectType: 'ContentItem',
        objectId: item.id,
        deepLinkPath: `/app/content?item=${encodeURIComponent(item.id)}`,
      });
      return;
    }
    if (evt.targetType === 'WorkDeliverable') {
      await notifyDeliverable(evt.tenantId, evt.actorUserId ?? null, evt.targetId, type);
    }
  } catch (err) {
    log.warn({ err, action: evt.action }, 'notification delivery failed');
  }
}

export async function notifyDeliverable(
  tenantId: string,
  actorUserId: string | null,
  deliverableId: string,
  type: NotificationType,
): Promise<void> {
  const prisma = getPrisma();
  const d = await prisma.workDeliverable.findFirst({
    where: tenantWhere(tenantId, { id: deliverableId }),
    select: { id: true, createdBy: true, taskId: true },
  });
  if (!d) return;
  const task = d.taskId
    ? await prisma.workTask.findFirst({
        where: tenantWhere(tenantId, { id: d.taskId }),
        select: { assigneeUserId: true, createdBy: true },
      })
    : null;
  let recipients: Array<string | null | undefined> = [
    d.createdBy,
    task?.assigneeUserId,
    task?.createdBy,
  ];
  if (type === 'deliverable.review') {
    recipients = recipients.concat(
      await membersWithCaps(tenantId, ['deliverable.review.decide', 'deliverable.review']),
    );
  }
  if (type === 'deliverable.comment') {
    const prior = await prisma.workDeliverableComment.findMany({
      where: { tenantId, deliverableId },
      select: { authorUserId: true },
      take: 50,
    });
    recipients = recipients.concat(prior.map((p) => p.authorUserId));
  }
  await deliverNotifications({
    tenantId,
    actorUserId,
    type,
    recipients,
    objectType: 'WorkDeliverable',
    objectId: d.id,
    deepLinkPath: `/app/deliverables/${encodeURIComponent(d.id)}`,
  });
}

export async function notifyTask(
  tenantId: string,
  actorUserId: string | null,
  taskId: string,
  type: 'task.assigned' | 'task.comment',
): Promise<void> {
  try {
    const prisma = getPrisma();
    const task = await prisma.workTask.findFirst({
      where: tenantWhere(tenantId, { id: taskId }),
      select: { id: true, assigneeUserId: true, createdBy: true },
    });
    if (!task) return;
    let recipients: Array<string | null> = [task.assigneeUserId];
    if (type === 'task.comment') {
      const prior = await prisma.workTaskComment.findMany({
        where: { tenantId, taskId },
        select: { authorUserId: true },
        take: 50,
      });
      recipients = recipients.concat(task.createdBy, ...prior.map((p) => p.authorUserId));
    }
    await deliverNotifications({
      tenantId,
      actorUserId,
      type,
      recipients,
      objectType: 'WorkTask',
      objectId: task.id,
      deepLinkPath: `/app/tasks?task=${encodeURIComponent(task.id)}`,
    });
  } catch (err) {
    log.warn({ err, type }, 'task notification failed');
  }
}

export async function safeNotifyDeliverable(
  ...args: Parameters<typeof notifyDeliverable>
): Promise<void> {
  try {
    await notifyDeliverable(...args);
  } catch (err) {
    log.warn({ err }, 'deliverable notification failed');
  }
}
