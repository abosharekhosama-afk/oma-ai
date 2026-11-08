import { getPrisma } from '@oma/db';
import { effectiveApprovalPolicy, resolveApprovalSettings, skipReasonMessage } from '@oma/domain';

export async function findDuePublishTargetIds(
  now: Date,
  key: Buffer | null,
): Promise<{ ids: string[]; skipped: number }> {
  const prisma = getPrisma();
  let skipped = 0;
  const [prefs, settings] = await Promise.all([
    prisma.contentPreferences.findMany({
      select: { brandId: true, tenantId: true, approvalPolicy: true, approvalMode: true },
    }),
    prisma.workspaceSetting.findMany({
      select: { tenantId: true, approvalMode: true },
    }),
  ]);
  const wsModeByTenant = new Map(settings.map((row) => [row.tenantId, row.approvalMode]));
  const noApproval = new Set<string>();
  const seen = new Set<string>();
  for (const pref of prefs) {
    seen.add(pref.brandId);
    const policy = resolveApprovalSettings(
      { approvalMode: wsModeByTenant.get(pref.tenantId) },
      { approvalMode: pref.approvalMode, approvalPolicy: pref.approvalPolicy },
    ).policy;
    if (policy !== 'REQUIRED') noApproval.add(pref.brandId);
  }
  const skipApprovalTenantIds = settings
    .filter((row) => effectiveApprovalPolicy(row.approvalMode, null) !== 'REQUIRED')
    .map((row) => row.tenantId);
  if (skipApprovalTenantIds.length > 0) {
    const inherited = await prisma.brandWorkspace.findMany({
      where: { tenantId: { in: skipApprovalTenantIds }, deletedAt: null },
      select: { id: true },
    });
    for (const brand of inherited) {
      if (!seen.has(brand.id)) noApproval.add(brand.id);
    }
  }

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
    const eligible = row.approvalState === 'APPROVED' || noApproval.has(row.brandId);
    if (!eligible) {
      skipped += 1;
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

  if (!key) return { ids: [], skipped };

  const targets = await prisma.contentPublishTarget.findMany({
    where: {
      publishState: { in: ['NONE', 'QUEUED'] },
      OR: [{ nextPublishAt: null }, { nextPublishAt: { lte: now } }],
      contentItem: {
        archivedAt: null,
        scheduleState: 'SCHEDULED',
        scheduledAt: { lte: now },
        OR: [{ approvalState: 'APPROVED' }, { brandId: { in: [...noApproval] } }],
      },
    },
    orderBy: { contentItem: { scheduledAt: 'asc' } },
    take: 50,
    select: { id: true },
  });
  return { ids: targets.map((t) => t.id), skipped };
}
