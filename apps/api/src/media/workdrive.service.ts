import { getPrisma, hydratePlan } from '@oma/db';
import {
  checkSsrfHost,
  discoverWorkDrive,
  workDriveUrlCandidates,
  clientFromConnection,
  clientFromPlatformKey,
  DomainError,
  encryptToken,
  ensurePlatformScopedKey,
  isWorkDriveKey,
  newId,
  REQUIRED_SCOPES,
  revokePlatformKeyForTenant,
  workDriveDefaultUrl,
  WorkDriveClient,
  WorkDriveError,
  workDriveKeyPrefix,
  workDriveLimits,
  workDriveMasterConfig,
  workDriveSecretKey,
  type FetchLike,
  type PlatformKeyStore,
} from '@oma/domain';
import { billingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import {
  backfillBackups,
  backupStatus,
  enqueueBackupIfNeeded,
  retryFailedBackups,
} from './storage-backup';
import { cancelMigration, migrationStatus, startMigration } from './storage-migrate';

type Conn = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getPrisma>['workDriveConnection']['findUnique']>>
>;

const bad = (msg: string, key: string) => new DomainError('VALIDATION_FAILED', msg, 400, key);

/** Maps WorkDrive failures to OMA errors with user-facing message keys. */
export function workDriveDomainError(e: unknown): DomainError {
  if (e instanceof DomainError) return e;
  if (!(e instanceof WorkDriveError)) {
    return new DomainError(
      'WORKDRIVE_ERROR',
      'WorkDrive request failed',
      502,
      'errors.workdrive_unavailable',
    );
  }
  switch (e.code) {
    case 'invalid_url':
      return bad(e.message, 'errors.workdrive_invalid_url');
    case 'invalid_key':
      return bad(e.message, 'errors.workdrive_invalid_key');
    case 'unauthorized':
      return new DomainError('WORKDRIVE_ERROR', e.message, 422, 'errors.workdrive_key_rejected');
    case 'forbidden':
      return new DomainError('WORKDRIVE_ERROR', e.message, 422, 'errors.workdrive_forbidden');
    case 'quota_exceeded':
      return new DomainError(
        'STORAGE_QUOTA_EXCEEDED',
        e.message,
        403,
        'errors.storage_quota_exceeded',
      );
    case 'not_found':
      return new DomainError('MEDIA_MISSING', e.message, 410, 'errors.media_missing');
    case 'too_large':
      return new DomainError('PAYLOAD_TOO_LARGE', e.message, 413, 'errors.media_too_large');
    case 'rate_limited':
      return new DomainError('RATE_LIMITED', e.message, 429, 'errors.workdrive_busy');
    default:
      return new DomainError('WORKDRIVE_ERROR', e.message, 502, 'errors.workdrive_unavailable');
  }
}

/** Errors while connecting/testing: never "file removed"; always about the address or the key. */
export function workDriveConnectError(e: unknown): DomainError {
  if (e instanceof DomainError) return e;
  const code = e instanceof WorkDriveError ? e.code : 'unavailable';
  const err = (key: string, status = 422) =>
    new DomainError('WORKDRIVE_ERROR', (e as Error)?.message ?? key, status, key);
  switch (code) {
    case 'invalid_url':
      return bad('Invalid WorkDrive address', 'errors.workdrive_invalid_url');
    case 'invalid_key':
      return bad('Invalid WorkDrive key', 'errors.workdrive_invalid_key');
    case 'unauthorized':
      return err('errors.workdrive_key_rejected');
    case 'forbidden':
      return err('errors.workdrive_key_forbidden');
    case 'outdated':
      return err('errors.workdrive_outdated');
    case 'not_workdrive':
    case 'not_found':
    case 'bad_response':
      return err('errors.workdrive_not_workdrive');
    case 'rate_limited':
      return new DomainError('RATE_LIMITED', (e as Error).message, 429, 'errors.workdrive_busy');
    default:
      return err('errors.workdrive_unreachable', 502);
  }
}

export function mapConnection(c: Conn | null) {
  const key = workDriveSecretKey();
  const limits = workDriveLimits();
  return {
    available: !!key,
    connected: !!c,
    default_url: workDriveDefaultUrl() || null,
    max_video_mb: Math.round(limits.maxVideoBytes / 1048576),
    max_image_mb: Math.round(limits.maxImageBytes / 1048576),
    connection: c
      ? {
          base_url: c.baseUrl,
          key_prefix: c.keyPrefix,
          org_name: c.orgName,
          root_folder: c.rootFolderId ? { id: c.rootFolderId, name: c.rootFolderName } : null,
          scopes: c.scopes,
          status: c.status,
          last_checked_at: c.lastCheckedAt?.toISOString() ?? null,
          last_error: c.lastError,
          connected_at: c.createdAt.toISOString(),
        }
      : null,
  };
}

export class WorkDriveService {
  /** Test seam: replaced in unit tests; production uses global fetch. */
  static fetchImpl: FetchLike | undefined;

  constructor(private readonly audit: AuditService) {}

  private secret() {
    const key = workDriveSecretKey();
    if (!key)
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'WorkDrive storage is not enabled on this server',
        409,
        'errors.workdrive_not_enabled',
      );
    return key;
  }

  async connection(tenantId: string) {
    return getPrisma().workDriveConnection.findUnique({ where: { tenantId } });
  }

  async status(tenantId: string) {
    return { data: mapConnection(await this.connection(tenantId)) };
  }

  /** Connected client for a tenant, or null when the tenant has not connected WorkDrive. */
  async clientFor(tenantId: string): Promise<{ client: WorkDriveClient; conn: Conn } | null> {
    const conn = await this.connection(tenantId);
    const key = workDriveSecretKey();
    if (!conn || !key) return null;
    return { client: clientFromConnection(conn, key, WorkDriveService.fetchImpl), conn };
  }

  async requireClient(tenantId: string) {
    const c = await this.clientFor(tenantId);
    if (!c)
      throw new DomainError(
        'WORKDRIVE_NOT_CONNECTED',
        'WorkDrive is not connected',
        409,
        'errors.workdrive_not_connected',
      );
    return c;
  }

  /** Test seam so integration files can enable the master account without sharing process.env. */
  static masterConfigImpl: typeof workDriveMasterConfig | undefined;

  masterConfig() {
    return (WorkDriveService.masterConfigImpl ?? workDriveMasterConfig)();
  }

  masterClient() {
    const cfg = this.masterConfig();
    if (!cfg) return null;
    return new WorkDriveClient(cfg.baseUrl, cfg.apiKey, WorkDriveService.fetchImpl);
  }

  private platformKeyStore(): PlatformKeyStore {
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

  async ensureInternalClient(tenantId: string) {
    const cfg = this.masterConfig();
    const master = this.masterClient();
    if (!cfg || !master) return null;
    const key = workDriveSecretKey();
    if (key) {
      try {
        await ensurePlatformScopedKey({
          tenantId,
          master,
          secret: key,
          store: this.platformKeyStore(),
        });
      } catch {
        // Feature-detect fallback: keep using the master key + path.
      }
    }
    const setting = await getPrisma().workspaceStorageSetting.findUnique({ where: { tenantId } });
    if (key && setting?.platformKeyStatus === 'active' && setting.platformKeyEnc) {
      return {
        client: clientFromPlatformKey(
          cfg.baseUrl,
          setting.platformKeyEnc,
          key,
          WorkDriveService.fetchImpl,
        ),
        conn: {
          id: `scoped:${tenantId}`,
          rootFolderId: setting.platformRootFolderId,
          rootFolderName: null,
        },
        provider: 'OMA_INTERNAL' as const,
        tenantId,
      };
    }
    return {
      client: master,
      conn: { id: `master:${tenantId}`, rootFolderId: null, rootFolderName: null },
      provider: 'OMA_INTERNAL' as const,
      tenantId,
    };
  }

  async revokePlatformKey(tenantId: string) {
    const master = this.masterClient();
    if (!master) return;
    await revokePlatformKeyForTenant({
      tenantId,
      master,
      store: this.platformKeyStore(),
    });
  }

  async effectiveMode(
    tenantId: string,
  ): Promise<'OMA_INTERNAL' | 'USER_WORKDRIVE' | 'SYNC_BACKUP'> {
    const setting = await getPrisma().workspaceStorageSetting.findUnique({ where: { tenantId } });
    if (setting) return setting.mode;
    if (await this.connection(tenantId)) return 'USER_WORKDRIVE';
    return 'OMA_INTERNAL';
  }

  /**
   * Browse/import source: `oma` = platform storage, `workdrive` = the workspace BYOS connection.
   */
  parseLibrarySource(raw?: string | null): 'oma' | 'workdrive' | undefined {
    if (raw == null || String(raw).trim() === '') return undefined;
    const v = String(raw).trim().toLowerCase();
    if (v === 'oma' || v === 'internal' || v === 'oma_internal') return 'oma';
    if (v === 'workdrive' || v === 'user' || v === 'user_workdrive' || v === 'byos') {
      return 'workdrive';
    }
    throw new DomainError(
      'VALIDATION_FAILED',
      'source must be oma or workdrive',
      400,
      'errors.validation_failed',
    );
  }

  /**
   * Client used to browse/import/preview files. Defaults to the workspace storage mode.
   * `source=workdrive` always uses the BYOS connection; `source=oma` always uses the
   * platform client (scoped child key when minted, otherwise master + path guard).
   */
  async resolveLibraryClient(tenantId: string, source?: 'oma' | 'workdrive' | null) {
    const mode = await this.effectiveMode(tenantId);
    const want = source ?? (mode === 'USER_WORKDRIVE' ? 'workdrive' : 'oma');
    if (want === 'workdrive') {
      const user = await this.requireClient(tenantId);
      return {
        ...user,
        provider: 'USER_WORKDRIVE' as const,
        tenantId,
        source: 'workdrive' as const,
      };
    }
    const internal = await this.ensureInternalClient(tenantId);
    if (!internal) {
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'WorkDrive storage is not enabled on this server',
        409,
        'errors.workdrive_not_enabled',
      );
    }
    return { ...internal, source: 'oma' as const };
  }

  /**
   * Client used to write a new file. Prefers the workspace mode: BYOS when explicitly set (or
   * when a connection exists and no setting row was created), otherwise the platform master.
   */
  async resolveWriteTarget(tenantId: string) {
    const mode = await this.effectiveMode(tenantId);
    const user = await this.clientFor(tenantId);
    if (mode === 'USER_WORKDRIVE' && user) {
      return { ...user, provider: 'USER_WORKDRIVE' as const, tenantId };
    }
    const internal = await this.ensureInternalClient(tenantId);
    if (internal) return internal;
    if (user) return { ...user, provider: 'USER_WORKDRIVE' as const, tenantId };
    throw new DomainError(
      'WORKDRIVE_NOT_CONNECTED',
      'WorkDrive is not connected',
      409,
      'errors.workdrive_not_connected',
    );
  }

  async clientForAsset(tenantId: string, asset: { storageProvider?: string | null }) {
    if (asset.storageProvider === 'OMA_INTERNAL') {
      const internal = await this.ensureInternalClient(tenantId);
      if (!internal)
        throw new DomainError(
          'WORKDRIVE_NOT_CONNECTED',
          'WorkDrive is not connected',
          409,
          'errors.workdrive_not_connected',
        );
      return internal;
    }
    const user = await this.requireClient(tenantId);
    return { ...user, provider: 'USER_WORKDRIVE' as const, tenantId };
  }

  async canUpload(tenantId: string) {
    try {
      await this.resolveWriteTarget(tenantId);
      return true;
    } catch {
      return false;
    }
  }

  private byosWorking(conn: Conn | null) {
    return !!conn && conn.status === 'CONNECTED';
  }

  async storageStatus(tenantId: string) {
    const mode = await this.effectiveMode(tenantId);
    const conn = await this.connection(tenantId);
    const usage = await billingService.usage(tenantId);
    const plan = await hydratePlan(await billingService.getPlanCode(tenantId));
    return {
      data: {
        mode,
        used_bytes: usage.storage_bytes,
        limit_bytes: plan.limits.storage_bytes ?? null,
        byos_connected: !!conn,
        byos_status: conn?.status ?? null,
        internal_available: !!this.masterConfig(),
        backup_available: true,
        can_upload: await this.canUpload(tenantId),
        last_quota_reconcile: await this.lastQuotaReconcile(),
      },
    };
  }

  private async lastQuotaReconcile() {
    const row = await getPrisma().storageQuotaReconcile.findUnique({ where: { id: 'latest' } });
    if (!row) return null;
    return {
      at: row.ranAt.toISOString(),
      oma_internal_bytes: Number(row.omaInternalBytes),
      platform_used_bytes: row.platformUsedBytes == null ? null : Number(row.platformUsedBytes),
      platform_limit_bytes: row.platformLimitBytes == null ? null : Number(row.platformLimitBytes),
      drift_bytes: row.driftBytes == null ? null : Number(row.driftBytes),
      tenants_scanned: row.tenantsScanned,
      notes: row.notes,
    };
  }

  async setStorageMode(tenantId: string, userId: string, body: unknown, correlationId?: string) {
    const raw = (body ?? {}) as Record<string, unknown>;
    const mode = raw.mode;
    const allowed = ['OMA_INTERNAL', 'USER_WORKDRIVE', 'SYNC_BACKUP'] as const;
    if (typeof mode !== 'string' || !(allowed as readonly string[]).includes(mode)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Invalid storage mode',
        400,
        'errors.storage_mode_invalid',
      );
    }
    const conn = await this.connection(tenantId);
    const working = this.byosWorking(conn);
    const internal = !!this.masterConfig();
    if (mode === 'USER_WORKDRIVE' && !working) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Connect WorkDrive before switching to it',
        409,
        'errors.storage_mode_byos_required',
      );
    }
    if (mode === 'OMA_INTERNAL' && !internal) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Platform storage is not configured',
        409,
        'errors.storage_mode_internal_unavailable',
      );
    }
    if (mode === 'SYNC_BACKUP' && !(internal && working)) {
      throw new DomainError(
        'CONFLICT_STATE',
        'Sync and backup needs platform storage and a connected WorkDrive',
        409,
        'errors.storage_mode_sync_unavailable',
      );
    }
    const next = mode as (typeof allowed)[number];
    const prev = await getPrisma().workspaceStorageSetting.findUnique({ where: { tenantId } });
    await getPrisma().workspaceStorageSetting.upsert({
      where: { tenantId },
      create: { tenantId, mode: next },
      update: { mode: next },
    });
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'storage.mode_changed',
      targetType: 'WorkspaceStorageSetting',
      targetId: tenantId,
      beforeRef: prev?.mode,
      afterRef: next,
      correlationId,
    });
    return this.storageStatus(tenantId);
  }

  private async fallbackToInternalIfNeeded(
    tenantId: string,
    userId: string,
    correlationId?: string,
  ) {
    if (!this.masterConfig()) return;
    const setting = await getPrisma().workspaceStorageSetting.findUnique({ where: { tenantId } });
    if (!setting || setting.mode === 'OMA_INTERNAL') return;
    await getPrisma().workspaceStorageSetting.update({
      where: { tenantId },
      data: { mode: 'OMA_INTERNAL' },
    });
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'storage.mode_changed',
      targetType: 'WorkspaceStorageSetting',
      targetId: tenantId,
      beforeRef: setting.mode,
      afterRef: 'OMA_INTERNAL',
      correlationId,
    });
  }

  private assertUrlAllowed(url: string) {
    if (process.env.NODE_ENV !== 'production' || process.env.WORKDRIVE_ALLOW_PRIVATE_URLS === '1')
      return;
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    const r = checkSsrfHost(host);
    if (!r.ok)
      throw new DomainError('URL_SSRF_DENIED', r.reason, 400, 'errors.workdrive_invalid_url');
    if (!url.startsWith('https://'))
      throw bad('URL must use https', 'errors.workdrive_invalid_url');
  }

  async connect(tenantId: string, userId: string, body: unknown, correlationId?: string) {
    const key = this.secret();
    const b = (body ?? {}) as Record<string, unknown>;
    let candidates: string[];
    try {
      candidates = workDriveUrlCandidates(b.base_url ?? b.baseUrl);
    } catch (e) {
      throw workDriveConnectError(e);
    }
    this.assertUrlAllowed(candidates[0]!);
    const apiKey =
      typeof (b.api_key ?? b.apiKey) === 'string' ? String(b.api_key ?? b.apiKey).trim() : '';
    if (!isWorkDriveKey(apiKey)) throw bad('Invalid WorkDrive key', 'errors.workdrive_invalid_key');
    let self;
    let baseUrl: string;
    try {
      ({ baseUrl, self } = await discoverWorkDrive(
        candidates[0],
        apiKey,
        WorkDriveService.fetchImpl,
      ));
    } catch (e) {
      throw workDriveConnectError(e);
    }
    const missing = REQUIRED_SCOPES.filter((s) => !self.scopes.includes(s));
    if (missing.length)
      throw new DomainError(
        'VALIDATION_FAILED',
        `Key is missing permissions: ${missing.join(', ')}`,
        422,
        'errors.workdrive_missing_scopes',
        missing,
      );
    const data = {
      baseUrl,
      apiKeyEnc: encryptToken(apiKey, key),
      keyPrefix: workDriveKeyPrefix(apiKey),
      orgId: self.organization.id,
      orgName: self.organization.name,
      rootFolderId: self.rootFolder?.id ?? null,
      rootFolderName: self.rootFolder?.name ?? null,
      scopes: self.scopes,
      status: 'CONNECTED' as const,
      lastCheckedAt: new Date(),
      lastError: null,
      connectedBy: userId,
    };
    const prev = await this.connection(tenantId);
    const row = await getPrisma().workDriveConnection.upsert({
      where: { tenantId },
      create: { id: newId(), tenantId, ...data },
      update: data,
    });
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: prev ? 'workdrive.reconnected' : 'workdrive.connected',
      targetType: 'WorkDriveConnection',
      targetId: row.id,
      afterRef: `${self.organization.id}:${data.keyPrefix}`,
      correlationId,
    });
    return { data: mapConnection(row) };
  }

  async test(tenantId: string, userId: string, correlationId?: string) {
    const { client, conn } = await this.requireClient(tenantId);
    let patch;
    try {
      const self = await client.self();
      patch = {
        status: 'CONNECTED' as const,
        lastError: null,
        orgName: self.organization.name,
        rootFolderId: self.rootFolder?.id ?? null,
        rootFolderName: self.rootFolder?.name ?? null,
        scopes: self.scopes,
      };
    } catch (e) {
      const d = workDriveConnectError(e);
      patch = { status: 'ERROR' as const, lastError: d.messageKey };
    }
    const row = await getPrisma().workDriveConnection.update({
      where: { id: conn.id },
      data: { ...patch, lastCheckedAt: new Date() },
    });
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'workdrive.tested',
      targetType: 'WorkDriveConnection',
      targetId: row.id,
      afterRef: row.status,
      correlationId,
    });
    return { data: mapConnection(row) };
  }

  /** Forgets the key. Media stays referenced (shown as unavailable until reconnected). */
  async disconnect(tenantId: string, userId: string, correlationId?: string) {
    const conn = await this.connection(tenantId);
    if (conn) {
      await getPrisma().workDriveConnection.delete({ where: { id: conn.id } });
      await this.audit.write({
        actorUserId: userId,
        tenantId,
        action: 'workdrive.disconnected',
        targetType: 'WorkDriveConnection',
        targetId: conn.id,
        correlationId,
      });
      await this.fallbackToInternalIfNeeded(tenantId, userId, correlationId);
    }
    return { data: mapConnection(null) };
  }

  enqueueBackupIfNeeded(asset: {
    id: string;
    tenantId: string;
    storageProvider: string;
    status: string;
  }) {
    return enqueueBackupIfNeeded(asset);
  }

  backupStatus(tenantId: string) {
    return backupStatus(tenantId);
  }

  async backfillBackups(tenantId: string, userId: string, correlationId?: string) {
    const result = await backfillBackups(tenantId);
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'storage.backup_backfilled',
      targetType: 'WorkspaceStorageSetting',
      targetId: tenantId,
      afterRef: String(result.data.enqueued),
      correlationId,
    });
    return result;
  }

  async retryFailedBackups(tenantId: string, userId: string, correlationId?: string) {
    const result = await retryFailedBackups(tenantId);
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'storage.backup_retried',
      targetType: 'WorkspaceStorageSetting',
      targetId: tenantId,
      afterRef: String(result.data.retried),
      correlationId,
    });
    return result;
  }

  migrationStatus(tenantId: string) {
    return migrationStatus(tenantId);
  }

  async startMigration(tenantId: string, userId: string, body: unknown, correlationId?: string) {
    const result = await startMigration(tenantId, userId, body);
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'storage.migrate_started',
      targetType: 'StorageMigration',
      targetId: result.data.migration?.id ?? tenantId,
      afterRef: String(result.data.candidate_count),
      correlationId,
    });
    return result;
  }

  async cancelMigration(tenantId: string, userId: string, correlationId?: string) {
    const result = await cancelMigration(tenantId);
    await this.audit.write({
      actorUserId: userId,
      tenantId,
      action: 'storage.migrate_cancelled',
      targetType: 'StorageMigration',
      targetId: result.data.migration?.id ?? tenantId,
      correlationId,
    });
    return result;
  }
}
