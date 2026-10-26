import { getPrisma } from '@oma/db';
import {
  checkSsrfHost,
  discoverWorkDrive,
  workDriveUrlCandidates,
  clientFromConnection,
  DomainError,
  encryptToken,
  isWorkDriveKey,
  newId,
  REQUIRED_SCOPES,
  workDriveDefaultUrl,
  WorkDriveClient,
  WorkDriveError,
  workDriveKeyPrefix,
  workDriveLimits,
  workDriveSecretKey,
  type FetchLike,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';

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
    }
    return { data: mapConnection(null) };
  }
}
