import { getPrisma } from '@oma/db';
import {
  backupBackoffMs,
  classifyBackupError,
  clientFromConnection,
  newId,
  internalMediaSegments,
  replicaFolderSegments,
  safeFileName,
  storageBackupConfig,
  storagePathOf,
  WorkDriveClient,
  workDriveMasterConfig,
  workDriveSecretKey,
  type FetchLike,
} from '@oma/domain';

export type BackupTickDeps = {
  now?: () => Date;
  fetchImpl?: FetchLike;
  masterConfig?: typeof workDriveMasterConfig;
  key?: Buffer | null;
  batchSize?: number;
  concurrency?: number;
  maxAttempts?: number;
};

async function mapPool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const width = Math.max(1, Math.min(n, queue.length || 1));
  await Promise.all(
    Array.from({ length: width }, async () => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        await fn(item);
      }
    }),
  );
}

export async function pauseTenantBackups(
  tenantId: string,
  connectionId: string,
  reason: 'quota_exceeded' | 'key_revoked',
  message: string,
  now = new Date(),
) {
  const prisma = getPrisma();
  const setting = await prisma.workspaceStorageSetting.findUnique({ where: { tenantId } });
  if (setting) {
    await prisma.workspaceStorageSetting.update({
      where: { tenantId },
      data: { backupPausedAt: now, backupPausedReason: reason },
    });
  } else {
    await prisma.workspaceStorageSetting.create({
      data: {
        tenantId,
        mode: 'SYNC_BACKUP',
        backupPausedAt: now,
        backupPausedReason: reason,
      },
    });
  }
  const lastError =
    reason === 'quota_exceeded'
      ? 'errors.storage_backup_quota'
      : 'errors.storage_backup_key_revoked';
  await prisma.workDriveConnection.updateMany({
    where: { id: connectionId, tenantId },
    data: {
      status: 'ERROR',
      lastError: `${lastError}: ${message}`.slice(0, 500),
      lastCheckedAt: now,
    },
  });
}

async function markAssetReplica(
  assetId: string,
  data: { replicaFileId?: string | null; replicaFolderId?: string | null; replicaStatus: string },
) {
  await getPrisma().mediaAsset.update({ where: { id: assetId }, data });
}

export async function runBackupTick(deps: BackupTickDeps = {}) {
  const cfg = storageBackupConfig();
  const now = deps.now?.() ?? new Date();
  const key = deps.key === undefined ? workDriveSecretKey() : deps.key;
  const out = { scanned: 0, done: 0, failed: 0, skipped: 0, retried: 0, paused: 0 };
  if (!key) return out;
  const masterFactory = deps.masterConfig ?? workDriveMasterConfig;
  const masterCfg = masterFactory();
  const prisma = getPrisma();

  await prisma.storageBackupJob.updateMany({
    where: {
      status: 'RUNNING',
      startedAt: { lt: new Date(now.getTime() - cfg.staleRunningMs) },
    },
    data: { status: 'PENDING', nextAttemptAt: now },
  });

  const paused = await prisma.workspaceStorageSetting.findMany({
    where: { backupPausedAt: { not: null } },
    select: { tenantId: true },
  });
  const pausedIds = paused.map((p) => p.tenantId);

  const jobs = await prisma.storageBackupJob.findMany({
    where: {
      status: 'PENDING',
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        pausedIds.length
          ? { OR: [{ kind: { not: 'BACKUP' } }, { tenantId: { notIn: pausedIds } }] }
          : {},
        masterCfg ? {} : { kind: 'REPLICA_TRASH' },
      ],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: deps.batchSize ?? cfg.batchSize,
    include: { asset: true },
  });
  out.scanned = jobs.length;

  const master = masterCfg
    ? new WorkDriveClient(masterCfg.baseUrl, masterCfg.apiKey, deps.fetchImpl)
    : null;

  await mapPool(jobs, deps.concurrency ?? cfg.concurrency, async (job) => {
    const claimed = await prisma.storageBackupJob.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'RUNNING', startedAt: now },
    });
    if (claimed.count !== 1) return;
    try {
      const result = await processBackupJob(job, {
        now,
        key,
        master,
        fetchImpl: deps.fetchImpl,
        maxAttempts: deps.maxAttempts ?? cfg.maxAttempts,
        backoffMs: cfg.backoffMs,
        maxBackoffMs: cfg.maxBackoffMs,
      });
      if (result === 'DONE') out.done++;
      else if (result === 'SKIPPED') out.skipped++;
      else if (result === 'FAILED') out.failed++;
      else if (result === 'PENDING') out.retried++;
      else if (result === 'PAUSED') {
        out.failed++;
        out.paused++;
      }
    } catch (e) {
      await prisma.storageBackupJob.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          attempts: { increment: 1 },
          lastError: e instanceof Error ? e.message : String(e),
          nextAttemptAt: new Date(now.getTime() + cfg.backoffMs),
        },
      });
      out.retried++;
    }
  });

  return out;
}

async function processBackupJob(
  job: {
    id: string;
    tenantId: string;
    mediaAssetId: string;
    workdriveConnectionId: string;
    kind: string;
    attempts: number;
    replicaFileId: string | null;
    asset: {
      id: string;
      tenantId: string;
      brandId: string | null;
      kind: string;
      name: string;
      mime: string;
      size: bigint;
      sha256: string | null;
      status: string;
      storageProvider: string;
      storagePath: string | null;
      workdriveFileId: string;
      replicaFileId: string | null;
      replicaFolderId: string | null;
      createdBy: string;
    };
  },
  opts: {
    now: Date;
    key: Buffer;
    master: WorkDriveClient | null;
    fetchImpl?: FetchLike;
    maxAttempts: number;
    backoffMs: number;
    maxBackoffMs: number;
  },
): Promise<'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING' | 'PAUSED'> {
  const prisma = getPrisma();
  const finish = async (
    status: 'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING',
    extra: Record<string, unknown> = {},
  ) => {
    await prisma.storageBackupJob.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt: status === 'PENDING' ? null : opts.now,
        ...extra,
      },
    });
    return status;
  };

  if (job.kind === 'REPLICA_TRASH') {
    return processReplicaTrash(job, opts, finish);
  }
  if (job.kind === 'MIGRATE') {
    if (!opts.master) return retryOrFail(job, opts, 'Platform storage is not configured', finish);
    return processMigrate(job, opts, finish);
  }
  if (!opts.master) return retryOrFail(job, opts, 'Platform storage is not configured', finish);

  if (job.asset.storageProvider !== 'OMA_INTERNAL' || job.asset.status === 'MISSING') {
    await markAssetReplica(job.asset.id, { replicaStatus: 'skipped' });
    return finish('SKIPPED', { lastError: 'Asset is not available for backup' });
  }

  const existingId = job.replicaFileId || job.asset.replicaFileId;
  if (existingId) {
    await markAssetReplica(job.asset.id, {
      replicaFileId: existingId,
      replicaFolderId: job.asset.replicaFolderId,
      replicaStatus: 'ready',
    });
    return finish('DONE', { replicaFileId: existingId });
  }

  const setting = await prisma.workspaceStorageSetting.findUnique({
    where: { tenantId: job.tenantId },
  });
  if (setting?.mode && setting.mode !== 'SYNC_BACKUP') {
    await markAssetReplica(job.asset.id, { replicaStatus: 'skipped' });
    return finish('SKIPPED', { lastError: 'Workspace is not in sync-and-backup mode' });
  }

  const conn = await prisma.workDriveConnection.findUnique({
    where: { id: job.workdriveConnectionId },
  });
  if (!conn || conn.status !== 'CONNECTED') {
    await markAssetReplica(job.asset.id, { replicaStatus: 'skipped' });
    return finish('SKIPPED', { lastError: 'WorkDrive is not connected' });
  }

  const dest = clientFromConnection(conn, opts.key, opts.fetchImpl);
  const brand = job.asset.brandId
    ? await prisma.brandWorkspace.findUnique({
        where: { id: job.asset.brandId },
        select: { name: true },
      })
    : null;
  const segs = replicaFolderSegments({
    brandName: brand?.name,
    brandId: job.asset.brandId,
    kind: job.asset.kind,
    rootFolderName: conn.rootFolderName,
    userId: job.asset.createdBy,
  });
  const replicaPath = storagePathOf(segs);

  let sourceUrl: string;
  const sha256 = job.asset.sha256;
  try {
    const signed = await opts.master.downloadUrl(job.asset.workdriveFileId);
    sourceUrl = signed.url;
  } catch (e) {
    const info = classifyBackupError(e);
    if (info.skip) {
      await markAssetReplica(job.asset.id, { replicaStatus: 'skipped' });
      return finish('SKIPPED', { lastError: info.message });
    }
    return retryOrFail(job, opts, info.message, finish);
  }

  try {
    const folder = await dest.ensurePath(segs);
    const uploaded = await dest.uploadFromSignedSource({
      folderId: folder.folderId,
      name: safeFileName(job.asset.name),
      mimeType: job.asset.mime,
      size: Number(job.asset.size),
      sha256: sha256 ?? undefined,
      sourceUrl,
    });
    await markAssetReplica(job.asset.id, {
      replicaFileId: uploaded.fileId,
      replicaFolderId: folder.folderId,
      replicaStatus: 'ready',
    });
    return finish('DONE', {
      replicaFileId: uploaded.fileId,
      replicaPath,
      lastError: null,
    });
  } catch (e) {
    const info = classifyBackupError(e);
    if (info.pauseReason) {
      await pauseTenantBackups(job.tenantId, conn.id, info.pauseReason, info.message, opts.now);
      await markAssetReplica(job.asset.id, { replicaStatus: 'failed' });
      await prisma.storageBackupJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          attempts: job.attempts + 1,
          lastError: info.message,
          finishedAt: opts.now,
        },
      });
      return 'PAUSED';
    }
    if (info.skip) {
      await markAssetReplica(job.asset.id, { replicaStatus: 'skipped' });
      return finish('SKIPPED', { lastError: info.message });
    }
    return retryOrFail(job, opts, info.message, finish);
  }
}

async function retryOrFail(
  job: { id: string; attempts: number; mediaAssetId: string },
  opts: { now: Date; maxAttempts: number; backoffMs: number; maxBackoffMs: number },
  message: string,
  finish: (
    status: 'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING',
    extra?: Record<string, unknown>,
  ) => Promise<'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING'>,
) {
  const attempts = job.attempts + 1;
  if (attempts >= opts.maxAttempts) {
    await markAssetReplica(job.mediaAssetId, { replicaStatus: 'failed' });
    return finish('FAILED', { attempts, lastError: message });
  }
  return finish('PENDING', {
    attempts,
    lastError: message,
    nextAttemptAt: new Date(
      opts.now.getTime() + backupBackoffMs(attempts, opts.backoffMs, opts.maxBackoffMs),
    ),
    finishedAt: null,
  });
}

/** Exported for tests that want a deterministic job id. */
export function newBackupJobId() {
  return newId();
}

async function processReplicaTrash(
  job: {
    id: string;
    tenantId: string;
    mediaAssetId: string;
    workdriveConnectionId: string;
    replicaFileId: string | null;
    asset: { id: string; replicaFileId: string | null };
    attempts: number;
  },
  opts: {
    now: Date;
    key: Buffer;
    fetchImpl?: FetchLike;
    maxAttempts: number;
    backoffMs: number;
    maxBackoffMs: number;
  },
  finish: (
    status: 'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING',
    extra?: Record<string, unknown>,
  ) => Promise<'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING'>,
) {
  const fileId = job.replicaFileId || job.asset.replicaFileId;
  if (!fileId) return finish('SKIPPED', { lastError: 'No replica to delete' });
  const conn = await getPrisma().workDriveConnection.findUnique({
    where: { id: job.workdriveConnectionId },
  });
  if (!conn) return finish('SKIPPED', { lastError: 'WorkDrive is not connected' });
  try {
    const dest = clientFromConnection(conn, opts.key, opts.fetchImpl);
    await dest.trash(fileId);
    await getPrisma().mediaAsset.update({
      where: { id: job.asset.id },
      data: { replicaFileId: null, replicaFolderId: null, replicaStatus: null },
    });
    return finish('DONE', { replicaFileId: fileId, lastError: null });
  } catch (e) {
    const info = classifyBackupError(e);
    if (info.skip) {
      await getPrisma().mediaAsset.update({
        where: { id: job.asset.id },
        data: { replicaFileId: null, replicaFolderId: null, replicaStatus: null },
      });
      return finish('DONE', { lastError: info.message });
    }
    if (info.pauseReason === 'key_revoked' || !info.retryable) {
      return finish('FAILED', { attempts: job.attempts + 1, lastError: info.message });
    }
    return retryOrFail(job, opts, info.message, finish);
  }
}

async function processMigrate(
  job: {
    id: string;
    tenantId: string;
    mediaAssetId: string;
    workdriveConnectionId: string;
    attempts: number;
    asset: {
      id: string;
      tenantId: string;
      brandId: string | null;
      kind: string;
      name: string;
      mime: string;
      size: bigint;
      sha256: string | null;
      status: string;
      storageProvider: string;
      storagePath: string | null;
      workdriveFileId: string;
      createdBy: string;
    };
  },
  opts: {
    now: Date;
    key: Buffer;
    master: WorkDriveClient | null;
    fetchImpl?: FetchLike;
    maxAttempts: number;
    backoffMs: number;
    maxBackoffMs: number;
  },
  finish: (
    status: 'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING',
    extra?: Record<string, unknown>,
  ) => Promise<'DONE' | 'SKIPPED' | 'FAILED' | 'PENDING'>,
) {
  const prisma = getPrisma();
  const migration = await prisma.storageMigration.findFirst({
    where: { tenantId: job.tenantId, status: { in: ['PENDING', 'RUNNING'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!migration || migration.status === 'CANCELLED') {
    return finish('SKIPPED', { lastError: 'Migration was cancelled' });
  }
  if (job.asset.storageProvider === 'OMA_INTERNAL') {
    await prisma.storageMigration.update({
      where: { id: migration.id },
      data: { skipped: { increment: 1 } },
    });
    return finish('SKIPPED', { lastError: 'Already on OMA storage' });
  }
  if (job.asset.status === 'MISSING') {
    await prisma.storageMigration.update({
      where: { id: migration.id },
      data: { skipped: { increment: 1 } },
    });
    return finish('SKIPPED', { lastError: 'Asset is missing' });
  }
  if (!opts.master) return retryOrFail(job, opts, 'Platform storage is not configured', finish);
  const conn = await prisma.workDriveConnection.findUnique({
    where: { id: job.workdriveConnectionId },
  });
  if (!conn || conn.status !== 'CONNECTED') {
    await prisma.storageMigration.update({
      where: { id: migration.id },
      data: { failed: { increment: 1 }, lastError: 'WorkDrive is not connected' },
    });
    return finish('FAILED', { lastError: 'WorkDrive is not connected' });
  }
  const source = clientFromConnection(conn, opts.key, opts.fetchImpl);
  const segs = internalMediaSegments({
    tenantId: job.asset.tenantId,
    brandId: job.asset.brandId,
    kind: job.asset.kind,
    userId: job.asset.createdBy,
  });
  try {
    const signed = await source.downloadUrl(job.asset.workdriveFileId);
    const sha256 = job.asset.sha256;
    const folder = await opts.master.ensurePath(segs);
    const uploaded = await opts.master.uploadFromSignedSource({
      folderId: folder.folderId,
      name: safeFileName(job.asset.name),
      mimeType: job.asset.mime,
      size: Number(job.asset.size),
      sha256: sha256 ?? undefined,
      sourceUrl: signed.url,
    });
    const previousId = job.asset.workdriveFileId;
    await prisma.mediaAsset.update({
      where: { id: job.asset.id },
      data: {
        storageProvider: 'OMA_INTERNAL',
        storagePath: storagePathOf(segs),
        workdriveFileId: uploaded.fileId,
        folderId: folder.folderId,
      },
    });
    if (migration.deleteSource) {
      await source.trash(previousId).catch(() => undefined);
    }
    await prisma.storageMigration.update({
      where: { id: migration.id },
      data: { completed: { increment: 1 } },
    });
    await maybeFinishMigration(migration.id, job.tenantId, opts.now, job.id);
    return finish('DONE', { replicaFileId: uploaded.fileId, replicaPath: storagePathOf(segs) });
  } catch (e) {
    const info = classifyBackupError(e);
    if (info.retryable) return retryOrFail(job, opts, info.message, finish);
    await prisma.storageMigration.update({
      where: { id: migration.id },
      data: { failed: { increment: 1 }, lastError: info.message },
    });
    await maybeFinishMigration(migration.id, job.tenantId, opts.now, job.id);
    return finish('FAILED', { attempts: job.attempts + 1, lastError: info.message });
  }
}

async function maybeFinishMigration(
  migrationId: string,
  tenantId: string,
  now: Date,
  excludeJobId?: string,
) {
  const prisma = getPrisma();
  const open = await prisma.storageBackupJob.count({
    where: {
      tenantId,
      kind: 'MIGRATE',
      status: { in: ['PENDING', 'RUNNING'] },
      ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
    },
  });
  if (open > 0) return;
  const migration = await prisma.storageMigration.findUnique({ where: { id: migrationId } });
  if (!migration || migration.status === 'CANCELLED' || migration.status === 'DONE') return;
  await prisma.storageMigration.update({
    where: { id: migrationId },
    data: {
      status: migration.failed > 0 && migration.completed === 0 ? 'FAILED' : 'DONE',
      finishedAt: now,
    },
  });
}
