import { getPrisma } from '@oma/db';
import { skipReasonMessage } from '@oma/domain';

export async function findDuePublishTargetIds(now: Date, key: Buffer | null): Promise<string[]> {
  const prisma = getPrisma();
  const noApproval = (
    await prisma.contentPreferences.findMany({
      where: { approvalPolicy: 'NONE' },
      select: { brandId: true },
    })
  ).map((p) => p.brandId);

  const dueItems = await prisma.contentItem.findMany({
    where: {
      archivedAt: null,
      scheduleState: 'SCHEDULED',
      scheduledAt: { lte: now },
      publishTargets: { some: {} },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
    select: {
      id: true,
      brandId: true,
      approvalState: true,
      lastPublishSkipReason: true,
    },
  });

  for (const row of dueItems) {
    const eligible = row.approvalState === 'APPROVED' || noApproval.includes(row.brandId);
    if (!eligible) {
      const reason = skipReasonMessage('NOT_APPROVED');
      if (row.lastPublishSkipReason !== reason) {
        await prisma.contentItem.update({
          where: { id: row.id },
          data: { lastPublishSkipReason: reason },
        });
      }
      continue;
    }
    if (!key) {
      const reason = skipReasonMessage('ENCRYPTION_KEY');
      if (row.lastPublishSkipReason !== reason) {
        await prisma.contentItem.update({
          where: { id: row.id },
          data: { lastPublishSkipReason: reason },
        });
      }
    }
  }

  if (!key) return [];

  const targets = await prisma.contentPublishTarget.findMany({
    where: {
      publishState: { in: ['NONE', 'QUEUED'] },
      OR: [{ nextPublishAt: null }, { nextPublishAt: { lte: now } }],
      contentItem: {
        archivedAt: null,
        scheduleState: 'SCHEDULED',
        scheduledAt: { lte: now },
        OR: [{ approvalState: 'APPROVED' }, { brandId: { in: noApproval } }],
      },
    },
    orderBy: { contentItem: { scheduledAt: 'asc' } },
    take: 50,
    select: { id: true },
  });
  return targets.map((t) => t.id);
}
