import { getPrisma } from '@oma/db';
import { newId, resolveApprovalSettings } from '@oma/domain';

/** Once-a-day reminder for pending approvals when the workspace or brand toggle is on. */
export async function tickApprovalReminders(): Promise<number> {
  const prisma = getPrisma();
  const [settings, prefs] = await Promise.all([
    prisma.workspaceSetting.findMany({
      select: { tenantId: true, approvalMode: true, reminderPendingApprovals: true },
    }),
    prisma.contentPreferences.findMany({
      select: {
        brandId: true,
        tenantId: true,
        approvalMode: true,
        approvalPolicy: true,
        reminderPendingApprovals: true,
      },
    }),
  ]);
  const wsByTenant = new Map(settings.map((row) => [row.tenantId, row]));
  const prefByBrand = new Map(prefs.map((row) => [row.brandId, row]));
  const tenantIds = new Set<string>([...wsByTenant.keys(), ...prefs.map((row) => row.tenantId)]);
  if (tenantIds.size === 0) return 0;
  const day = new Date().toISOString().slice(0, 10);
  let created = 0;
  for (const tenantId of tenantIds) {
    const ws = wsByTenant.get(tenantId);
    const pending = await prisma.contentItem.findMany({
      where: {
        tenantId,
        archivedAt: null,
        approvalState: { in: ['PENDING', 'PARTIALLY_APPROVED'] },
      },
      select: { id: true, brandId: true },
      take: 80,
    });
    const wanted = pending.filter((item) => {
      const pref = prefByBrand.get(item.brandId);
      return resolveApprovalSettings(
        {
          approvalMode: ws?.approvalMode,
          reminderPendingApprovals: ws?.reminderPendingApprovals ?? false,
        },
        pref
          ? {
              approvalMode: pref.approvalMode,
              approvalPolicy: pref.approvalPolicy,
              reminderPendingApprovals: pref.reminderPendingApprovals,
            }
          : null,
      ).reminderPendingApprovals;
    });
    if (!wanted.length) continue;
    const approvers = await prisma.membership.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        grants: { some: { revokedAt: null, capabilityCode: 'content.approve' } },
      },
      select: { userId: true },
    });
    const userIds = [...new Set(approvers.map((m) => m.userId).filter(Boolean) as string[])];
    if (!userIds.length) continue;
    const rows = wanted.flatMap((item) =>
      userIds.map((uid) => ({
        id: newId(),
        tenantId,
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
