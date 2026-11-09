import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

type AssetLike = {
  id: string;
  tenantId: string;
  storageProvider: string;
  status: string;
};

export async function enqueueBackupIfNeeded(asset: AssetLike) {
  if (asset.storageProvider !== 'OMA_INTERNAL' || asset.status === 'MISSING') return null;
  const prisma = getPrisma();
  const setting = await prisma.workspaceStorageSetting.findUnique({
    where: { tenantId: asset.tenantId },
  });
  if (setting?.mode !== 'SYNC_BACKUP') return null;
  const conn = await prisma.workDriveConnection.findUnique({ where: { tenantId: asset.tenantId } });
  if (!conn || conn.status !== 'CONNECTED') return null;
  const existing = await prisma.storageBackupJob.findUnique({
    where: {
      mediaAssetId_workdriveConnectionId: {
        mediaAssetId: asset.id,
        workdriveConnectionId: conn.id,
      },
    },
  });
  if (existing) return existing;
  const job = await prisma.storageBackupJob.create({
    data: {
      id: newId(),
      tenantId: asset.tenantId,
      mediaAssetId: asset.id,
      workdriveConnectionId: conn.id,
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(),
    },
  });
  await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: { replicaStatus: asset.storageProvider === 'OMA_INTERNAL' ? 'pending' : undefined },
  });
  return job;
}

export async function backupStatus(tenantId: string) {
  const prisma = getPrisma();
  const grouped = await prisma.storageBackupJob.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: { _all: true },
  });
  const counts = { pending: 0, running: 0, done: 0, failed: 0, skipped: 0 };
  for (const row of grouped) {
    const key = row.status.toLowerCase() as keyof typeof counts;
    if (key in counts) counts[key] = row._count._all;
  }
  const lastSuccess = await prisma.storageBackupJob.findFirst({
    where: { tenantId, status: 'DONE' },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true, updatedAt: true },
  });
  const lastError = await prisma.storageBackupJob.findFirst({
    where: { tenantId, lastError: { not: null }, status: { in: ['FAILED', 'PENDING'] } },
    orderBy: { updatedAt: 'desc' },
    select: { lastError: true, updatedAt: true, mediaAssetId: true, status: true },
  });
  const setting = await prisma.workspaceStorageSetting.findUnique({ where: { tenantId } });
  return {
    data: {
      counts,
      last_success_at:
        lastSuccess?.finishedAt?.toISOString() ?? lastSuccess?.updatedAt.toISOString() ?? null,
      last_error: lastError
        ? {
            message: lastError.lastError,
            at: lastError.updatedAt.toISOString(),
            asset_id: lastError.mediaAssetId,
            status: lastError.status,
          }
        : null,
      paused: Boolean(setting?.backupPausedAt),
      paused_reason: setting?.backupPausedReason ?? null,
      paused_at: setting?.backupPausedAt?.toISOString() ?? null,
    },
  };
}

export async function backfillBackups(tenantId: string) {
  const prisma = getPrisma();
  const setting = await prisma.workspaceStorageSetting.findUnique({ where: { tenantId } });
  const conn = await prisma.workDriveConnection.findUnique({ where: { tenantId } });
  if (setting?.mode !== 'SYNC_BACKUP' || !conn || conn.status !== 'CONNECTED') {
    return { data: { enqueued: 0, skipped: 0 } };
  }
  const assets = await prisma.mediaAsset.findMany({
    where: { tenantId, storageProvider: 'OMA_INTERNAL', status: 'READY' },
    select: { id: true, tenantId: true, storageProvider: true, status: true },
  });
  let enqueued = 0;
  let skipped = 0;
  for (const asset of assets) {
    const before = await prisma.storageBackupJob.findUnique({
      where: {
        mediaAssetId_workdriveConnectionId: {
          mediaAssetId: asset.id,
          workdriveConnectionId: conn.id,
        },
      },
    });
    if (before) {
      skipped++;
      continue;
    }
    await enqueueBackupIfNeeded(asset);
    enqueued++;
  }
  return { data: { enqueued, skipped } };
}

export async function retryFailedBackups(tenantId: string) {
  const prisma = getPrisma();
  const now = new Date();
  await prisma.workspaceStorageSetting.updateMany({
    where: { tenantId },
    data: { backupPausedAt: null, backupPausedReason: null },
  });
  await prisma.workDriveConnection.updateMany({
    where: {
      tenantId,
      status: 'ERROR',
      lastError: { startsWith: 'errors.storage_backup_' },
    },
    data: { status: 'CONNECTED', lastError: null, lastCheckedAt: now },
  });
  const result = await prisma.storageBackupJob.updateMany({
    where: { tenantId, status: 'FAILED' },
    data: {
      status: 'PENDING',
      nextAttemptAt: now,
      lastError: null,
      finishedAt: null,
    },
  });
  return { data: { retried: result.count } };
}
