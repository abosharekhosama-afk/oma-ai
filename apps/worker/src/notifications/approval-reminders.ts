import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

/** Once-a-day reminder for pending approvals when the workspace toggle is on. */
export async function tickApprovalReminders(): Promise<number> {
  const prisma = getPrisma();
  const settings = await prisma.workspaceSetting.findMany({
    where: { reminderPendingApprovals: true },
    select: { tenantId: true },
  });
  if (!settings.length) return 0;
  const day = new Date().toISOString().slice(0, 10);
  let created = 0;
  for (const s of settings) {
    const pending = await prisma.contentItem.findMany({
      where: {
        tenantId: s.tenantId,
        archivedAt: null,
        approvalState: { in: ['PENDING', 'PARTIALLY_APPROVED'] },
      },
      select: { id: true },
      take: 80,
    });
    if (!pending.length) continue;
    const approvers = await prisma.membership.findMany({
      where: {
        tenantId: s.tenantId,
        status: 'ACTIVE',
        grants: { some: { revokedAt: null, capabilityCode: 'content.approve' } },
      },
      select: { userId: true },
    });
    const userIds = [...new Set(approvers.map((m) => m.userId).filter(Boolean) as string[])];
    if (!userIds.length) continue;
    const rows = pending.flatMap((item) =>
      userIds.map((uid) => ({
        id: newId(),
        tenantId: s.tenantId,
        recipientUserId: uid,
        type: 'content.approval_requested',
        objectType: 'ContentItem',
        objectId: item.id,
        deepLinkPath: `/app/content?item=${encodeURIComponent(item.id)}`,
        dedupeKey: `content.approval_requested:${item.id}:${uid}:reminder:${day}`,
      })),
    );
    if (!rows.length) continue;
    const res = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
    created += res.count;
  }
  return created;
}
