import {
  DomainError,
  WorkDriveClient,
  clientFromConnection,
  clientFromPlatformKey,
  decideStorageWriteProvider,
  effectiveStorageMode,
  ensurePlatformScopedKey,
  internalMediaSegments,
  storagePathOf,
  newId,
  storageFolderSegments,
  workDriveMasterConfig,
  workDriveSecretKey,
  type FetchLike,
  type LibrarySource,
  type MediaKind,
  type PlatformKeyStore,
  type StorageModeValue,
  type StorageProviderValue,
} from '@oma/domain';
import { getPrisma } from './prisma.service';
import { hydratePlan, snapshotUsage, throwLimit } from './billing-usage';
import { resolveAdminStorageLimitBytes } from './admin-storage-limit';
import { resolveTenantLimitOverride } from './tenant-limit-override';

/**
 * Storage write/read targets for code outside the API media service (worker jobs, catalog
 * generation). Same decision as the API: `decideStorageWriteProvider` on the workspace setting.
 */
export type StorageTarget = {
  client: WorkDriveClient;
  provider: StorageProviderValue;
  tenantId: string;
  conn: { id: string; rootFolderId: string | null; rootFolderName: string | null };
};

export type StorageTargetDeps = {
  key?: Buffer | null;
  fetchImpl?: FetchLike;
  masterConfig?: () => { baseUrl: string; apiKey: string } | null;
};

function platformKeyStore(): PlatformKeyStore {
  const prisma = getPrisma();
  return {
    async get(tenantId) {
      const row = await prisma.workspaceStorageSetting.findUnique({ where: { tenantId } });
      if (!row) return null;
      return {
        platformKeyEnc: row.platformKeyEnc,
        platformKeyPrefix: row.platformKeyPrefix,
        platformKeyId: row.platformKeyId,
        platformRootFolderId: row.platformRootFolderId,
        platformKeyStatus: row.platformKeyStatus,
      };
    },
    async save(tenantId, data) {
      await prisma.workspaceStorageSetting.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
    },
  };
}

/** OMA platform storage client for a tenant (scoped child key when minted, else master). */
export async function internalStorageTarget(
  tenantId: string,
  deps: StorageTargetDeps = {},
): Promise<StorageTarget | null> {
  const cfg = (deps.masterConfig ?? workDriveMasterConfig)();
  if (!cfg) return null;
  const master = new WorkDriveClient(cfg.baseUrl, cfg.apiKey, deps.fetchImpl);
  const key = deps.key === undefined ? workDriveSecretKey() : deps.key;
  if (key) {
    try {
      await ensurePlatformScopedKey({ tenantId, master, secret: key, store: platformKeyStore() });
    } catch {
      /* keep master + tenant path */
    }
  }
  const setting = await getPrisma().workspaceStorageSetting.findUnique({ where: { tenantId } });
  if (key && setting?.platformKeyStatus === 'active' && setting.platformKeyEnc) {
    return {
      client: clientFromPlatformKey(cfg.baseUrl, setting.platformKeyEnc, key, deps.fetchImpl),
      provider: 'OMA_INTERNAL',
      tenantId,
      conn: {
        id: `scoped:${tenantId}`,
        rootFolderId: setting.platformRootFolderId,
        rootFolderName: null,
      },
    };
  }
  return {
    client: master,
    provider: 'OMA_INTERNAL',
    tenantId,
    conn: { id: `master:${tenantId}`, rootFolderId: null, rootFolderName: null },
  };
}

/** The workspace's own WorkDrive (BYOS) client when connected. */
export async function userWorkDriveTarget(
  tenantId: string,
  deps: StorageTargetDeps = {},
): Promise<StorageTarget | null> {
  const key = deps.key === undefined ? workDriveSecretKey() : deps.key;
  if (!key) return null;
  const conn = await getPrisma().workDriveConnection.findUnique({ where: { tenantId } });
  if (!conn || conn.status !== 'CONNECTED') return null;
  return {
    client: clientFromConnection(conn, key, deps.fetchImpl),
    provider: 'USER_WORKDRIVE',
    tenantId,
    conn: { id: conn.id, rootFolderId: conn.rootFolderId, rootFolderName: conn.rootFolderName },
  };
}

export async function workspaceStorageMode(tenantId: string): Promise<StorageModeValue> {
  const prisma = getPrisma();
  const [setting, conn] = await Promise.all([
    prisma.workspaceStorageSetting.findUnique({ where: { tenantId }, select: { mode: true } }),
    prisma.workDriveConnection.findUnique({ where: { tenantId }, select: { id: true } }),
  ]);
  return effectiveStorageMode({ settingMode: setting?.mode ?? null, byosConnected: !!conn });
}

export function storageUnavailableError(reason: 'oma_unavailable' | 'workdrive_unavailable') {
  return reason === 'oma_unavailable'
    ? new DomainError(
        'STORAGE_OMA_UNAVAILABLE',
        'OMA storage is not available',
        409,
        'errors.storage_oma_unavailable',
      )
    : new DomainError(
        'STORAGE_WORKDRIVE_UNAVAILABLE',
        'Your WorkDrive is not connected',
        409,
        'errors.storage_workdrive_unavailable',
      );
}

/** Where a new file for this tenant goes, following the workspace storage setting. */
export async function resolveStorageWriteTarget(
  tenantId: string,
  deps: StorageTargetDeps & { source?: LibrarySource | null } = {},
): Promise<StorageTarget> {
  const mode = await workspaceStorageMode(tenantId);
  const [internal, user] = await Promise.all([
    deps.source === 'workdrive' ? null : internalStorageTarget(tenantId, deps),
    deps.source === 'oma' ? null : userWorkDriveTarget(tenantId, deps),
  ]);
  const decision = decideStorageWriteProvider({
    mode,
    source: deps.source ?? null,
    internalAvailable: !!internal,
    byosAvailable: !!user,
  });
  if (!decision.ok) throw storageUnavailableError(decision.reason);
  return decision.provider === 'OMA_INTERNAL' ? internal! : user!;
}

/** Client that can read an existing asset (by the provider it was stored on). */
export async function storageTargetForAsset(
  tenantId: string,
  asset: { storageProvider?: string | null },
  deps: StorageTargetDeps = {},
): Promise<StorageTarget> {
  if (asset.storageProvider === 'OMA_INTERNAL') {
    const t = await internalStorageTarget(tenantId, deps);
    if (!t) throw storageUnavailableError('oma_unavailable');
    return t;
  }
  const t = await userWorkDriveTarget(tenantId, deps);
  if (!t) throw storageUnavailableError('workdrive_unavailable');
  return t;
}

/** Brand media-kind folder segments for a target (tenant tree on OMA, OMA/{slug}/{kind} on BYOS). */
export function storageTargetFolderSegments(
  target: StorageTarget,
  brand: { id: string; name: string },
  kind: MediaKind,
): string[] {
  return storageFolderSegments({
    provider: target.provider,
    tenantId: target.tenantId,
    brand,
    kind,
    scopedRoot: target.provider === 'OMA_INTERNAL' && !!target.conn.rootFolderId,
    rootFolderName: target.conn.rootFolderName,
  });
}

/**
 * Quota gate before writing `adding` bytes to OMA storage. Same limit as the subscription page:
 * super-admin override, then tenant override, then the plan. BYOS writes are not counted.
 */
export async function assertOmaStorageQuota(tenantId: string, adding: number) {
  const prisma = getPrisma();
  const sub = await prisma.workspaceSubscription.findUnique({ where: { tenantId } });
  const plan = await hydratePlan(sub?.planCode ?? '');
  let limit = await resolveTenantLimitOverride(
    tenantId,
    'storage_bytes',
    plan.limits.storage_bytes ?? null,
  );
  limit = await resolveAdminStorageLimitBytes(tenantId, limit ?? null);
  if (limit == null) return { limit: null, used: 0 };
  const usage = await snapshotUsage(tenantId, sub?.currentPeriodStart ?? new Date());
  const used = usage.storage_bytes ?? 0;
  if (used + Math.max(0, adding) > limit) {
    throwLimit('storage_bytes', plan.code, limit, used, adding);
  }
  return { limit, used };
}

/** Queue a WorkDrive backup copy for an OMA asset when the workspace is in SYNC_BACKUP mode. */
export async function enqueueStorageBackupIfNeeded(asset: {
  id: string;
  tenantId: string;
  storageProvider: string;
  status: string;
}) {
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
      mediaAssetId_workdriveConnectionId_kind: {
        mediaAssetId: asset.id,
        workdriveConnectionId: conn.id,
        kind: 'BACKUP',
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
      kind: 'BACKUP',
      status: 'PENDING',
      attempts: 0,
      nextAttemptAt: new Date(),
    },
  });
  await prisma.mediaAsset.update({ where: { id: asset.id }, data: { replicaStatus: 'pending' } });
  return job;
}

/**
 * Upload bytes for a brand media kind to a resolved target. Enforces the OMA storage quota
 * before writing (BYOS writes are not counted) and returns the MediaAsset storage fields, so
 * every generated/imported file is recorded with the provider it really lives on.
 */
export async function uploadToStorageTarget(input: {
  target: StorageTarget;
  brand: { id: string; name: string };
  kind: MediaKind;
  name: string;
  mime: string;
  bytes: Buffer;
  sha256: string;
}) {
  const { target } = input;
  if (target.provider === 'OMA_INTERNAL') {
    await assertOmaStorageQuota(target.tenantId, input.bytes.length);
  }
  const segments = storageTargetFolderSegments(target, input.brand, input.kind);
  const { folderId } = await target.client.ensurePath(segments);
  const uploaded = await target.client.upload({
    folderId,
    name: input.name,
    mimeType: input.mime,
    sha256: input.sha256,
    source: {
      size: input.bytes.length,
      full: () => input.bytes,
      part: async (s, e) => input.bytes.subarray(s, e),
    },
  });
  return {
    fileId: uploaded.fileId,
    name: uploaded.name,
    folderId,
    storageProvider: target.provider,
    storagePath: storagePathFor(target, input.brand.id, input.kind),
  };
}

/** `MediaAsset.storagePath` for a brand kind on a target (only OMA storage records a path). */
export function storagePathFor(target: StorageTarget, brandId: string, kind: MediaKind) {
  return target.provider === 'OMA_INTERNAL'
    ? storagePathOf(internalMediaSegments({ tenantId: target.tenantId, brandId, kind }))
    : null;
}
