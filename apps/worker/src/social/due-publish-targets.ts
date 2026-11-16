import { getPrisma } from '@oma/db';
import {
  accountBlockers,
  effectiveApprovalPolicy,
  evaluateScheduleReadiness,
  resolveApprovalSettings,
  scheduleRequiresConnectedAccount,
  skipReasonMessage,
} from '@oma/domain';

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
      // Items with publish targets, or none at all: a scheduled post without an account
      // must surface CANNOT_SCHEDULE instead of waiting silently (DEC-023).
      OR: [{ publishTargets: { some: {} } }, { publishState: 'NONE' }],
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
    select: {
      id: true,
      brandId: true,
      channel: true,
      socialPageId: true,
      approvalState: true,
      lastPublishSkipReason: true,
      publishTargets: {
        select: { socialPageId: true, socialPage: { select: { network: true, status: true } } },
      },
    },
  });

  const requireAccount = scheduleRequiresConnectedAccount();
  const blockedItemIds: string[] = [];
  for (const row of dueItems) {
    const accounts = accountBlockers(
      evaluateScheduleReadiness({
        // Approval is evaluated separately below; only account readiness here.
        workflow: { status: 'APPROVED', scheduledAt: null, approvalState: 'APPROVED' },
        policy: 'NONE',
        channel: row.channel,
        targets: row.publishTargets.map((t) => ({
          socialPageId: t.socialPageId,
          network: t.socialPage.network,
          status: t.socialPage.status,
        })),
        requireConnectedAccount: requireAccount || row.publishTargets.length === 0,
      }),
    );
    if (accounts.length > 0) {
      skipped += 1;
      blockedItemIds.push(row.id);
      const reason =
        row.publishTargets.length === 0
          ? skipReasonMessage('NO_ACCOUNT')
          : skipReasonMessage(
              'ACCOUNT_NOT_CONNECTED',
              [...new Set(accounts.map((b) => b.code))].join(', '),
            );
      if (row.lastPublishSkipReason !== reason) {
        await prisma.contentItem.update({
          where: { id: row.id },
          data: { lastPublishSkipReason: reason },
        });
      }
      continue;
    }

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
      ...(blockedItemIds.length ? { contentItemId: { notIn: blockedItemIds } } : {}),
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
