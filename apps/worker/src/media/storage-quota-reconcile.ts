import { getPrisma } from '@oma/db';
import { workDriveMasterConfig, WorkDriveClient, type FetchLike } from '@oma/domain';

export type QuotaReconcileDeps = {
  now?: () => Date;
  fetchImpl?: FetchLike;
  masterConfig?: typeof workDriveMasterConfig;
};

export async function runQuotaReconcileTick(deps: QuotaReconcileDeps = {}) {
  const now = deps.now?.() ?? new Date();
  const prisma = getPrisma();
  const agg = await prisma.mediaAsset.aggregate({
    where: { storageProvider: 'OMA_INTERNAL', status: { not: 'MISSING' } },
    _sum: { size: true },
    _count: { _all: true },
  });
  const omaInternalBytes = agg._sum.size ?? 0n;
  const tenantsScanned = await prisma.mediaAsset.groupBy({
    by: ['tenantId'],
    where: { storageProvider: 'OMA_INTERNAL', status: { not: 'MISSING' } },
  });
  let platformUsed: bigint | null = null;
  let platformLimit: bigint | null = null;
  let notes: string | null = null;
  const masterCfg = (deps.masterConfig ?? workDriveMasterConfig)();
  if (masterCfg) {
    try {
      const master = new WorkDriveClient(masterCfg.baseUrl, masterCfg.apiKey, deps.fetchImpl);
      const q = await master.quota();
      platformUsed = BigInt(q.usedBytes);
      platformLimit = q.quotaBytes == null ? null : BigInt(q.quotaBytes);
    } catch (e) {
      notes = e instanceof Error ? e.message : String(e);
    }
  } else {
    notes = 'Platform master is not configured';
  }
  const drift = platformUsed == null ? null : platformUsed - omaInternalBytes;
  await prisma.storageQuotaReconcile.upsert({
    where: { id: 'latest' },
    create: {
      id: 'latest',
      ranAt: now,
      omaInternalBytes,
      platformUsedBytes: platformUsed,
      platformLimitBytes: platformLimit,
      driftBytes: drift,
      tenantsScanned: tenantsScanned.length,
      dryRun: false,
      notes,
    },
    update: {
      ranAt: now,
      omaInternalBytes,
      platformUsedBytes: platformUsed,
      platformLimitBytes: platformLimit,
      driftBytes: drift,
      tenantsScanned: tenantsScanned.length,
      notes,
    },
  });
  return {
    oma_internal_bytes: Number(omaInternalBytes),
    platform_used_bytes: platformUsed == null ? null : Number(platformUsed),
    platform_limit_bytes: platformLimit == null ? null : Number(platformLimit),
    drift_bytes: drift == null ? null : Number(drift),
    tenants_scanned: tenantsScanned.length,
    notes,
    at: now.toISOString(),
  };
}
