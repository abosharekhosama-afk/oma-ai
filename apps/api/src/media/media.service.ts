import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  allowedMimeFor,
  brandFolderSlug,
  DomainError,
  isMediaKind,
  maxBytesForMime,
  internalMediaSegments,
  mediaFolderSegments,
  newId,
  safeFileName,
  storagePathOf,
  WorkDriveClient,
  WorkDriveError,
  workDriveSecretKey,
  type MediaKind,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { workDriveDomainError, WorkDriveService } from './workdrive.service';
import { billingService } from '../billing/billing.service';

type Asset = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getPrisma>['mediaAsset']['findFirst']>>
>;

const notFound = () => new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
const bad = (msg: string, key = 'errors.validation_failed') =>
  new DomainError('VALIDATION_FAILED', msg, 400, key);

export const mediaViewUrl = (id: string) => `/api/v1/media/${id}/view`;
/**
 * Stable URL stored on content/ops records. Videos point at `/stream` so every client can tell a
 * video from an image by the URL alone. Both routes redirect to the same signed inline WorkDrive
 * URL (real bytes, stored MIME, HTTP Range), so the browser plays/loads straight from storage.
 */
export const mediaPlaybackUrl = (id: string, mime?: string | null) =>
  mime && mime.toLowerCase().startsWith('video/') ? `/api/v1/media/${id}/stream` : mediaViewUrl(id);

/** Capability needed to add media of each kind (checked in addition to brand.read at the guard). */
export const KIND_CAPABILITY: Record<MediaKind, string> = {
  posts: 'content.create',
  logos: 'brand.create',
  deliverables: 'deliverable.write',
};

export function mapAsset(a: Asset) {
  return {
    id: a.id,
    brand_id: a.brandId,
    kind: a.kind,
    name: a.name,
    mime: a.mime,
    size: Number(a.size),
    status: a.status,
    missing: a.status === 'MISSING',
    source: a.source,
    storage_provider: a.storageProvider,
    storage_path: a.storagePath,
    view_url: mediaViewUrl(a.id),
    stream_url: a.mime.startsWith('video/') ? `/api/v1/media/${a.id}/stream` : null,
    created_at: a.createdAt.toISOString(),
  };
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function parseKind(v: unknown): MediaKind {
  if (!isMediaKind(v)) throw bad('kind must be posts, logos or deliverables');
  return v;
}

function safeFolderName(raw: unknown): string {
  if (typeof raw !== 'string') throw bad('folder name required');
  const cleaned = raw
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex -- strip control characters from folder names
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) throw bad('folder name required');
  if (cleaned.length > 80) throw bad('folder name is too long');
  return cleaned;
}

type BrowseFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  updated_at: string | null;
};

async function collectAccessibleFiles(
  client: WorkDriveClient,
  startFolderId: string,
  allowed: string[],
  opts?: { maxFiles?: number; maxDepth?: number },
): Promise<BrowseFile[]> {
  const maxFiles = opts?.maxFiles ?? 250;
  const maxDepth = opts?.maxDepth ?? 4;
  const files: BrowseFile[] = [];
  const seen = new Set<string>();
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: startFolderId, depth: 0 }];
  while (queue.length && files.length < maxFiles) {
    const next = queue.shift();
    if (!next || visited.has(next.id)) continue;
    visited.add(next.id);
    const folder = await client.getFolder(next.id);
    for (const x of folder.files) {
      if (!allowed.includes(x.mimeType) || seen.has(x.id)) continue;
      seen.add(x.id);
      files.push({
        id: x.id,
        name: x.name,
        mime: x.mimeType,
        size: x.size,
        updated_at: x.updatedAt,
      });
      if (files.length >= maxFiles) break;
    }
    if (next.depth >= maxDepth) continue;
    for (const child of folder.folders) {
      if (!visited.has(child.id)) queue.push({ id: child.id, depth: next.depth + 1 });
    }
  }
  return files;
}

/** Counts bytes and hashes while streaming; aborts once `max` is exceeded. */
function meter(max: number) {
  const hash = createHash('sha256');
  let size = 0;
  const t = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length;
      if (size > max)
        return cb(
          new DomainError('PAYLOAD_TOO_LARGE', 'File too large', 413, 'errors.media_too_large'),
        );
      hash.update(chunk);
      cb(null, chunk);
    },
  });
  return { t, result: () => ({ size, sha256: hash.digest('hex') }) };
}

type Grant = {
  t: string;
  u: string;
  b: string;
  k: MediaKind;
  n: string;
  m: string;
  s: number;
  h: string;
  up: string;
  f: string;
  d: string;
  p: 'OMA_INTERNAL' | 'USER_WORKDRIVE';
  exp: number;
};

function grantKey() {
  const k = workDriveSecretKey();
  if (!k)
    throw new DomainError(
      'PROVIDER_NOT_CONFIGURED',
      'WorkDrive storage is not enabled on this server',
      409,
      'errors.workdrive_not_enabled',
    );
  return createHmac('sha256', k).update('oma-media-upload-grant/v1').digest();
}

export function signGrant(g: Grant) {
  const body = Buffer.from(JSON.stringify(g)).toString('base64url');
  const sig = createHmac('sha256', grantKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGrant(token: unknown): Grant | null {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const want = createHmac('sha256', grantKey()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const g = JSON.parse(Buffer.from(body, 'base64url').toString()) as Grant;
    if (typeof g.exp !== 'number' || g.exp < Date.now() || !isMediaKind(g.k)) return null;
    return g;
  } catch {
    return null;
  }
}

async function retryWorkDrive<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const retryable =
        (e instanceof WorkDriveError && e.retryable) ||
        /timeout|aborted|unreachable|ECONNRESET|ETIMEDOUT|429|5\d\d/i.test(
          String((e as Error)?.message ?? e),
        );
      if (!retryable || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw last;
}

export class MediaService {
  private folderCache = new Map<string, string>();

  constructor(
    private readonly audit: AuditService,
    private readonly workdrive: WorkDriveService,
  ) {}

  private async brand(tenantId: string, brandId: string) {
    const b = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId, deletedAt: null }),
      select: { id: true, name: true, status: true },
    });
    if (!b) throw notFound();
    return b;
  }

  /** Uploads a user's profile image to the active tenant's WorkDrive. */
  async uploadAvatar(
    ctx: { tenantId: string; userId: string; correlationId?: string },
    input: { name: unknown; mime: unknown; length: number | null; body: Readable },
  ) {
    const mime =
      typeof input.mime === 'string' ? input.mime.split(';')[0]!.trim().toLowerCase() : '';
    if (!AVATAR_MIMES.has(mime)) throw bad('Unsupported avatar image type', 'errors.media_type');
    if (input.length != null && (input.length <= 0 || input.length > AVATAR_MAX_BYTES))
      throw new DomainError(
        'PAYLOAD_TOO_LARGE',
        'Avatar is too large',
        413,
        'errors.media_too_large',
      );
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of input.body) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > AVATAR_MAX_BYTES)
        throw new DomainError(
          'PAYLOAD_TOO_LARGE',
          'Avatar is too large',
          413,
          'errors.media_too_large',
        );
      chunks.push(buf);
    }
    if (!size) throw bad('Empty avatar', 'errors.media_empty');
    const bytes = Buffer.concat(chunks);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const c = await this.workdrive.resolveWriteTarget(ctx.tenantId);
    const avatarSegs =
      c.provider === 'OMA_INTERNAL'
        ? internalMediaSegments({ tenantId: ctx.tenantId, kind: 'avatars', userId: ctx.userId })
        : ['OMA AI', 'profile-avatars', ctx.userId];
    const folder = await c.client.ensurePath(avatarSegs);
    const fileName = safeFileName(typeof input.name === 'string' ? input.name : 'avatar');
    let uploaded: { fileId: string; name: string };
    try {
      uploaded = await c.client.upload({
        folderId: folder.folderId,
        name: fileName,
        mimeType: mime,
        sha256,
        source: {
          size,
          full: () => bytes,
          part: async (start, end) => bytes.subarray(start, end),
        },
      });
    } catch (e) {
      throw workDriveDomainError(e);
    }
    const row = await getPrisma().mediaAsset.create({
      data: {
        id: newId(),
        tenantId: ctx.tenantId,
        brandId: null,
        kind: 'avatars',
        workdriveFileId: uploaded.fileId,
        folderId: folder.folderId,
        storageProvider: c.provider,
        storagePath: storagePathOf(avatarSegs),
        name: uploaded.name,
        mime,
        size: BigInt(size),
        sha256,
        source: 'upload',
        lastCheckedAt: new Date(),
        createdBy: ctx.userId,
      },
    });
    const avatarUrl = mediaViewUrl(row.id);
    await getPrisma().user.update({
      where: { id: ctx.userId },
      data: { avatarUrl, avatarAssetId: row.id },
    });
    await this.audit.write({
      actorUserId: ctx.userId,
      tenantId: ctx.tenantId,
      action: 'user.avatar_uploaded',
      targetType: 'User',
      targetId: ctx.userId,
      afterRef: row.id,
      correlationId: ctx.correlationId,
    });
    return { data: { asset_id: row.id, avatar_url: avatarUrl } };
  }

  private folderSegments(
    c: {
      client: WorkDriveClient;
      conn: { id: string; rootFolderName: string | null };
      provider?: 'OMA_INTERNAL' | 'USER_WORKDRIVE';
      tenantId?: string;
    },
    brand: { id: string; name: string },
    kind: MediaKind,
  ) {
    if (c.provider === 'OMA_INTERNAL' && c.tenantId) {
      return internalMediaSegments({ tenantId: c.tenantId, brandId: brand.id, kind });
    }
    return mediaFolderSegments({
      brandSlug: brandFolderSlug(brand.name, brand.id.slice(-8).toLowerCase()),
      kind,
      rootFolderName: c.conn.rootFolderName,
    });
  }

  private async folderFor(
    c: {
      client: WorkDriveClient;
      conn: { id: string; rootFolderName: string | null };
      provider?: 'OMA_INTERNAL' | 'USER_WORKDRIVE';
      tenantId?: string;
    },
    brand: { id: string; name: string },
    kind: MediaKind,
  ) {
    const segs = this.folderSegments(c, brand, kind);
    const k = `${c.conn.id}:${segs.join('/')}`;
    const hit = this.folderCache.get(k);
    if (hit) return hit;
    const { folderId } = await c.client.ensurePath(segs);
    this.folderCache.set(k, folderId);
    return folderId;
  }

  /** The brand browsing scope starts at the brand folder, not at one media-kind child. */
  private async brandFolderFor(
    c: {
      client: WorkDriveClient;
      conn: { id: string; rootFolderName: string | null };
      provider?: 'OMA_INTERNAL' | 'USER_WORKDRIVE';
      tenantId?: string;
    },
    brand: { id: string; name: string },
  ) {
    const kindPath = this.folderSegments(c, brand, 'posts');
    const segments = kindPath.slice(0, -1);
    const k = `${c.conn.id}:${segments.join('/')}`;
    const hit = this.folderCache.get(k);
    if (hit) return hit;
    const { folderId } = await c.client.ensurePath(segments);
    this.folderCache.set(k, folderId);
    return folderId;
  }

  private async assertInsideScope(client: WorkDriveClient, folderId: string, scopeRootId: string) {
    if (folderId === scopeRootId) return;
    let cursor = await client.getFolder(folderId);
    if (cursor.id === scopeRootId) return;
    for (let depth = 0; depth < 32 && cursor.parentId; depth += 1) {
      if (cursor.parentId === scopeRootId || cursor.id === scopeRootId) return;
      cursor = await client.getFolder(cursor.parentId);
      if (cursor.id === scopeRootId) return;
    }
    throw notFound();
  }

  private async resolveUploadFolder(
    c: {
      client: WorkDriveClient;
      conn: { id: string; rootFolderId: string | null; rootFolderName: string | null };
      provider?: 'OMA_INTERNAL' | 'USER_WORKDRIVE';
      tenantId?: string;
    },
    brand: { id: string; name: string },
    kind: MediaKind,
    folderId?: string | null,
  ) {
    if (!folderId) return this.folderFor(c, brand, kind);
    const scopeRootId = c.conn.rootFolderId || (await this.brandFolderFor(c, brand));
    await this.assertInsideScope(c.client, folderId, scopeRootId);
    return folderId;
  }

  private async decorateBrowseFiles(
    tenantId: string,
    brandId: string,
    files: BrowseFile[],
  ): Promise<{
    files: Array<
      BrowseFile & {
        asset_id: string | null;
        view_url: string;
        stream_url: string | null;
        usage_count: number;
        campaign_ids: string[];
        campaign_names: string[];
        uploader_id: string | null;
        uploader_name: string | null;
        missing: boolean;
        created_at: string | null;
      }
    >;
    filter_facets: {
      campaigns: Array<{ id: string; name: string }>;
      uploaders: Array<{ id: string; name: string }>;
    };
  }> {
    const brandCampaigns = await getPrisma().campaign.findMany({
      where: tenantWhere(tenantId, { brandId }),
      select: { id: true, nameEn: true },
      orderBy: { updatedAt: 'desc' },
      take: 24,
    });
    if (!files.length) {
      return {
        files: [],
        filter_facets: {
          campaigns: brandCampaigns.map((c) => ({ id: c.id, name: c.nameEn })),
          uploaders: [],
        },
      };
    }
    const assets = await getPrisma().mediaAsset.findMany({
      where: tenantWhere(tenantId, { workdriveFileId: { in: files.map((f) => f.id) } }),
    });
    const byWd = new Map(assets.map((a) => [a.workdriveFileId, a]));
    const assetIds = assets.map((a) => a.id);
    const posts = assetIds.length
      ? await getPrisma().contentItem.findMany({
          where: tenantWhere(tenantId, {
            archivedAt: null,
            OR: [{ previewAssetId: { in: assetIds } }, { mediaAssetIds: { hasSome: assetIds } }],
          }),
          select: { previewAssetId: true, mediaAssetIds: true, campaignId: true },
        })
      : [];
    const usage = new Map<string, { count: number; campaignIds: Set<string> }>();
    for (const p of posts) {
      const ids = new Set(
        [...p.mediaAssetIds, p.previewAssetId].filter((id): id is string => Boolean(id)),
      );
      for (const id of ids) {
        if (!assetIds.includes(id)) continue;
        const cur = usage.get(id) ?? { count: 0, campaignIds: new Set<string>() };
        cur.count += 1;
        if (p.campaignId) cur.campaignIds.add(p.campaignId);
        usage.set(id, cur);
      }
    }
    const users = assets.length
      ? await getPrisma().user.findMany({
          where: { id: { in: [...new Set(assets.map((a) => a.createdBy))] } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const campMap = new Map(brandCampaigns.map((c) => [c.id, c.nameEn]));
    const decorated = files.map((f) => {
      const a = byWd.get(f.id);
      const u = a ? usage.get(a.id) : undefined;
      const campaign_ids = u ? [...u.campaignIds] : [];
      return {
        ...f,
        asset_id: a?.id ?? null,
        view_url: a
          ? mediaPlaybackUrl(a.id, a.mime)
          : `/api/v1/brands/${brandId}/media/file-preview?file_id=${encodeURIComponent(f.id)}`,
        stream_url: a && a.mime.startsWith('video/') ? `/api/v1/media/${a.id}/stream` : null,
        usage_count: u?.count ?? 0,
        campaign_ids,
        campaign_names: campaign_ids.map((id) => campMap.get(id) ?? id),
        uploader_id: a?.createdBy ?? null,
        uploader_name: a ? (userMap.get(a.createdBy) ?? null) : null,
        missing: a?.status === 'MISSING',
        created_at: a?.createdAt.toISOString() ?? f.updated_at,
      };
    });
    const uploaders = new Map<string, string>();
    for (const f of decorated) {
      if (f.uploader_id && f.uploader_name) uploaders.set(f.uploader_id, f.uploader_name);
    }
    return {
      files: decorated,
      filter_facets: {
        campaigns: brandCampaigns.map((c) => ({ id: c.id, name: c.nameEn })),
        uploaders: [...uploaders].map(([id, name]) => ({ id, name })),
      },
    };
  }

  private assertCapability(caps: string[] | undefined, kind: MediaKind) {
    if (!caps?.includes(KIND_CAPABILITY[kind]))
      throw new DomainError(
        'PERMISSION_DENIED',
        'Missing capability',
        403,
        'errors.permission_denied',
      );
  }

  async list(
    tenantId: string,
    brandId: string,
    q: { kind?: string; cursor?: string; limit?: string },
  ) {
    await this.brand(tenantId, brandId);
    const conn = await this.workdrive.status(tenantId);
    const take = Math.min(Math.max(Number(q.limit) || 40, 1), 100);
    const rows = await getPrisma().mediaAsset.findMany({
      where: tenantWhere(tenantId, { brandId, ...(q.kind ? { kind: parseKind(q.kind) } : {}) }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return {
      data: {
        workdrive: {
          connected: conn.data.connected,
          available: conn.data.available,
          max_video_mb: conn.data.max_video_mb,
          max_image_mb: conn.data.max_image_mb,
          org_name: conn.data.connection?.org_name ?? null,
        },
        assets: rows.slice(0, take).map(mapAsset),
        next_cursor: rows.length > take ? rows[take - 1]!.id : null,
      },
    };
  }

  /**
   * Streams the request body to a temp file (hashing as it goes; never buffers the whole file),
   * then uploads it to the brand's WorkDrive folder and records a MediaAsset.
   */
  async upload(
    ctx: { tenantId: string; userId: string; capabilities?: string[]; correlationId?: string },
    brandId: string,
    input: {
      kind: unknown;
      name: unknown;
      mime: unknown;
      length: number | null;
      body: Readable;
      folder_id?: unknown;
    },
  ) {
    const kind = parseKind(input.kind);
    this.assertCapability(ctx.capabilities, kind);
    const target = await this.workdrive.resolveWriteTarget(ctx.tenantId);
    if (target.provider === 'OMA_INTERNAL') {
      await billingService.assertWithinLimit(ctx.tenantId, 'storage_bytes', { adding: 0 });
    }
    const brand = await this.brand(ctx.tenantId, brandId);
    if (brand.status === 'ARCHIVED')
      throw new DomainError('BRAND_ARCHIVED', 'Brand archived', 409, 'errors.brand_archived');
    const mime =
      typeof input.mime === 'string' ? input.mime.split(';')[0]!.trim().toLowerCase() : '';
    if (!allowedMimeFor(kind).includes(mime))
      throw bad('This file type is not supported', 'errors.media_type');
    const rawName = typeof input.name === 'string' ? input.name : '';
    let name = rawName;
    try {
      name = decodeURIComponent(rawName);
    } catch {
      /* keep raw */
    }
    name = safeFileName(name || 'file');
    const max = maxBytesForMime(mime);
    if (input.length != null && input.length > max)
      throw new DomainError('PAYLOAD_TOO_LARGE', 'File too large', 413, 'errors.media_too_large');
    if (input.length === 0) throw bad('Empty file', 'errors.media_empty');
    const c = target;

    const dir = await mkdtemp(join(tmpdir(), 'oma-upload-'));
    const path = join(dir, 'body');
    try {
      const m = meter(max);
      await pipeline(input.body, m.t, createWriteStream(path));
      const { size, sha256 } = m.result();
      if (c.provider === 'OMA_INTERNAL') {
        await billingService.assertWithinLimit(ctx.tenantId, 'storage_bytes', { adding: size });
      }
      if (!size) throw bad('Empty file', 'errors.media_empty');
      if (input.length != null && size !== input.length)
        throw bad('Upload was interrupted', 'errors.media_interrupted');

      let fileId: string;
      let storedName = name;
      let folderId: string;
      try {
        folderId = await this.resolveUploadFolder(
          c,
          brand,
          kind,
          typeof input.folder_id === 'string' ? input.folder_id : null,
        );
        const fh = await open(path, 'r');
        try {
          ({ fileId, name: storedName } = await retryWorkDrive(() =>
            c.client.upload({
              folderId,
              name,
              mimeType: mime,
              sha256,
              source: {
                size,
                full: () => Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>,
                part: async (start, end) => {
                  const buf = Buffer.alloc(end - start);
                  await fh.read(buf, 0, end - start, start);
                  return buf;
                },
              },
            }),
          ));
        } finally {
          await fh.close();
        }
      } catch (e) {
        // Folder may have been removed in WorkDrive; retry the path once next time.
        this.folderCache.clear();
        throw workDriveDomainError(e);
      }
      const row = await getPrisma().mediaAsset.create({
        data: {
          id: newId(),
          tenantId: ctx.tenantId,
          brandId,
          kind,
          workdriveFileId: fileId,
          folderId,
          storageProvider: c.provider,
          storagePath: storagePathOf(this.folderSegments(c, brand, kind)),
          name: storedName,
          mime,
          size: BigInt(size),
          sha256,
          source: 'upload',
          lastCheckedAt: new Date(),
          createdBy: ctx.userId,
        },
      });
      await this.audit.write({
        actorUserId: ctx.userId,
        tenantId: ctx.tenantId,
        action: 'media.uploaded',
        targetType: 'MediaAsset',
        targetId: row.id,
        afterRef: `${kind}:${fileId}`,
        correlationId: ctx.correlationId,
      });
      return { data: mapAsset(row) };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /**
   * Direct upload, step 1. Validates the file, reserves it in the brand's WorkDrive folder and
   * returns the short-lived signed PUT URL WorkDrive issued plus an OMA grant (HMAC-signed, 30 min)
   * that binds the reservation to this tenant, user, brand and file. The wdk_ key stays here.
   */
  async createUploadGrant(
    ctx: { tenantId: string; userId: string; capabilities?: string[]; correlationId?: string },
    brandId: string,
    body: unknown,
  ) {
    const b = (body ?? {}) as Record<string, unknown>;
    const kind = parseKind(b.kind);
    this.assertCapability(ctx.capabilities, kind);
    const brand = await this.brand(ctx.tenantId, brandId);
    if (brand.status === 'ARCHIVED')
      throw new DomainError('BRAND_ARCHIVED', 'Brand archived', 409, 'errors.brand_archived');
    const mime = typeof b.mime === 'string' ? b.mime.split(';')[0]!.trim().toLowerCase() : '';
    if (!allowedMimeFor(kind).includes(mime))
      throw bad('This file type is not supported', 'errors.media_type');
    const size = typeof b.size === 'number' && Number.isInteger(b.size) ? b.size : 0;
    if (size <= 0) throw bad('Empty file', 'errors.media_empty');
    if (size > maxBytesForMime(mime))
      throw new DomainError('PAYLOAD_TOO_LARGE', 'File too large', 413, 'errors.media_too_large');
    const sha256 = typeof b.sha256 === 'string' ? b.sha256.toLowerCase() : '';
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw bad('sha256 required');
    const name = safeFileName(typeof b.name === 'string' && b.name.trim() ? b.name : 'file');
    const c = await this.workdrive.resolveWriteTarget(ctx.tenantId);
    if (c.provider === 'OMA_INTERNAL') {
      await billingService.assertWithinLimit(ctx.tenantId, 'storage_bytes', { adding: size });
    }
    let r: Awaited<ReturnType<WorkDriveClient['requestUpload']>>;
    let folderId: string;
    try {
      folderId = await this.resolveUploadFolder(
        c,
        brand,
        kind,
        typeof b.folder_id === 'string' ? b.folder_id : null,
      );
      r = await c.client.requestUpload({ folderId, name, mimeType: mime, size, sha256 });
    } catch (e) {
      this.folderCache.clear();
      throw workDriveDomainError(e);
    }
    const exp = Date.now() + 30 * 60_000;
    const grant = signGrant({
      t: ctx.tenantId,
      u: ctx.userId,
      b: brandId,
      k: kind,
      n: r.name,
      m: mime,
      s: size,
      h: sha256,
      up: r.uploadId,
      f: r.fileId,
      d: folderId,
      p: c.provider,
      exp,
    });
    return {
      data: {
        upload_url: r.uploadUrl,
        method: 'PUT',
        headers: { 'content-type': mime },
        grant,
        expires_at: new Date(exp).toISOString(),
      },
    };
  }

  /** Direct upload, step 2: after the browser PUT the bytes, confirm with WorkDrive and record the asset. */
  async completeUploadGrant(
    ctx: { tenantId: string; userId: string; capabilities?: string[]; correlationId?: string },
    body: unknown,
  ) {
    const g = verifyGrant((body as Record<string, unknown> | null)?.grant);
    if (!g || g.t !== ctx.tenantId || g.u !== ctx.userId)
      throw new DomainError('PERMISSION_DENIED', 'Invalid upload grant', 403, 'errors.media_grant');
    this.assertCapability(ctx.capabilities, g.k);
    const existing = await getPrisma().mediaAsset.findFirst({
      where: tenantWhere(ctx.tenantId, { brandId: g.b, workdriveFileId: g.f }),
    });
    if (existing) return { data: mapAsset(existing) };
    const c =
      g.p === 'OMA_INTERNAL'
        ? await this.workdrive.clientForAsset(ctx.tenantId, { storageProvider: 'OMA_INTERNAL' })
        : {
            ...(await this.workdrive.requireClient(ctx.tenantId)),
            provider: 'USER_WORKDRIVE' as const,
          };
    let fileId: string;
    try {
      ({ fileId } = await c.client.completeUpload(g.up));
    } catch (e) {
      throw workDriveDomainError(e);
    }
    const row = await getPrisma().mediaAsset.create({
      data: {
        id: newId(),
        tenantId: ctx.tenantId,
        brandId: g.b,
        kind: g.k,
        workdriveFileId: fileId || g.f,
        folderId: g.d,
        storageProvider: g.p,
        storagePath:
          g.p === 'OMA_INTERNAL'
            ? storagePathOf(
                internalMediaSegments({ tenantId: ctx.tenantId, brandId: g.b, kind: g.k }),
              )
            : null,
        name: g.n,
        mime: g.m,
        size: BigInt(g.s),
        sha256: g.h,
        source: 'upload',
        lastCheckedAt: new Date(),
        createdBy: ctx.userId,
      },
    });
    await this.audit.write({
      actorUserId: ctx.userId,
      tenantId: ctx.tenantId,
      action: 'media.uploaded',
      targetType: 'MediaAsset',
      targetId: row.id,
      afterRef: `${g.k}:${row.workdriveFileId}`,
      correlationId: ctx.correlationId,
    });
    return { data: mapAsset(row) };
  }

  /** Use a file that is already in WorkDrive (picked in the browser). */
  async importFile(
    ctx: { tenantId: string; userId: string; capabilities?: string[]; correlationId?: string },
    brandId: string,
    body: unknown,
  ) {
    const b = (body ?? {}) as Record<string, unknown>;
    const kind = parseKind(b.kind);
    this.assertCapability(ctx.capabilities, kind);
    await this.brand(ctx.tenantId, brandId);
    const fileId = typeof b.file_id === 'string' ? b.file_id.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw bad('file_id required');
    const { client } = await this.workdrive.requireClient(ctx.tenantId);
    let d;
    try {
      d = await client.details(fileId);
    } catch (e) {
      throw workDriveDomainError(e);
    }
    if (!allowedMimeFor(kind).includes(d.mimeType))
      throw bad('This file type is not supported', 'errors.media_type');
    const existing = await getPrisma().mediaAsset.findFirst({
      where: tenantWhere(ctx.tenantId, { brandId, workdriveFileId: fileId }),
    });
    const row = existing
      ? await getPrisma().mediaAsset.update({
          where: { id: existing.id },
          data: {
            status: 'READY',
            missingSince: null,
            lastCheckedAt: new Date(),
            name: d.name,
            size: BigInt(d.size),
          },
        })
      : await getPrisma().mediaAsset.create({
          data: {
            id: newId(),
            tenantId: ctx.tenantId,
            brandId,
            kind,
            workdriveFileId: fileId,
            folderId: d.folderId,
            storageProvider: 'USER_WORKDRIVE',
            name: d.name,
            mime: d.mimeType,
            size: BigInt(d.size),
            source: 'workdrive',
            lastCheckedAt: new Date(),
            createdBy: ctx.userId,
          },
        });
    if (!existing)
      await this.audit.write({
        actorUserId: ctx.userId,
        tenantId: ctx.tenantId,
        action: 'media.linked',
        targetType: 'MediaAsset',
        targetId: row.id,
        afterRef: `${kind}:${fileId}`,
        correlationId: ctx.correlationId,
      });
    return { data: mapAsset(row) };
  }

  /** Browse brand or organization WorkDrive folders; every path stays inside the configured root. */
  async browse(
    tenantId: string,
    brandId: string,
    q: { folder_id?: string; kind?: string; scope?: string },
  ) {
    const brand = await this.brand(tenantId, brandId);
    const kind = q.kind ? parseKind(q.kind) : 'posts';
    const c = await this.workdrive.requireClient(tenantId);
    try {
      const allScope = q.scope === 'all';
      const organizationScope = q.scope === 'organization' || allScope;
      const rootFolderId = c.conn.rootFolderId;
      // Organization browse needs a configured root. Fall back to the brand folder so the
      // media card never surfaces a generic CONFLICT_STATE when the root is unset.
      const useOrgRoot = organizationScope && Boolean(rootFolderId);
      const brandFolderId = await this.brandFolderFor(c, brand);
      const startFolderId = useOrgRoot ? rootFolderId! : brandFolderId;
      const scopeRootId = startFolderId;
      const folderId = allScope ? startFolderId : q.folder_id || startFolderId;
      const f = await c.client.getFolder(folderId);
      if (f.id !== scopeRootId) await this.assertInsideScope(c.client, f.id, scopeRootId);
      const allowed = allowedMimeFor(kind);
      const atRoot = f.id === scopeRootId;
      const path: Array<{ id: string; name: string }> = [{ id: f.id, name: f.name }];
      if (!atRoot) {
        let cursor = f;
        for (let depth = 0; depth < 32 && cursor.parentId; depth += 1) {
          if (cursor.parentId === scopeRootId) {
            const root = await c.client.getFolder(scopeRootId);
            path.unshift({ id: root.id, name: root.name || c.conn.rootFolderName || root.id });
            break;
          }
          cursor = await c.client.getFolder(cursor.parentId);
          path.unshift({ id: cursor.id, name: cursor.name });
          if (cursor.id === scopeRootId) break;
        }
      }
      const files: BrowseFile[] = allScope
        ? await collectAccessibleFiles(c.client, startFolderId, allowed)
        : f.files
            .filter((x) => allowed.includes(x.mimeType))
            .map((x) => ({
              id: x.id,
              name: x.name,
              mime: x.mimeType,
              size: x.size,
              updated_at: x.updatedAt,
            }));
      // Brand Assets is the brand folder: flatten posts/logos children so the grid is not empty.
      if (f.id === brandFolderId && files.length === 0) {
        const flattenNames = kind === 'deliverables' ? ['deliverables'] : ['posts', 'logos'];
        const kids = f.folders.filter((child) => flattenNames.includes(child.name));
        if (kids.length) {
          const nested = await Promise.all(kids.map((child) => c.client.getFolder(child.id)));
          const seen = new Set(files.map((x) => x.id));
          for (const child of nested) {
            for (const x of child.files) {
              if (!allowed.includes(x.mimeType) || seen.has(x.id)) continue;
              seen.add(x.id);
              files.push({
                id: x.id,
                name: x.name,
                mime: x.mimeType,
                size: x.size,
                updated_at: x.updatedAt,
              });
            }
          }
        }
      }
      const decorated = await this.decorateBrowseFiles(tenantId, brandId, files);
      return {
        data: {
          folder: {
            id: allScope ? '__all__' : f.id,
            name: allScope ? 'All files' : f.name,
            parent_id: allScope || atRoot ? null : f.parentId,
          },
          root_name: c.conn.rootFolderName,
          brand_folder: { id: brandFolderId, name: brand.name },
          path: allScope ? [{ id: '__all__', name: 'All files' }] : path,
          folders: allScope ? [] : f.folders,
          files: decorated.files,
          filter_facets: decorated.filter_facets,
        },
      };
    } catch (e) {
      if (e instanceof WorkDriveError && e.code === 'not_found' && q.folder_id) throw notFound();
      throw workDriveDomainError(e);
    }
  }

  /** Create a folder under the current brand or organization WorkDrive scope. */
  async createFolder(
    ctx: { tenantId: string; userId: string; capabilities?: string[]; correlationId?: string },
    brandId: string,
    body: unknown,
  ) {
    const b = (body ?? {}) as Record<string, unknown>;
    const kind = b.kind ? parseKind(b.kind) : 'posts';
    this.assertCapability(ctx.capabilities, kind);
    const name = safeFolderName(b.name);
    const brand = await this.brand(ctx.tenantId, brandId);
    if (brand.status === 'ARCHIVED')
      throw new DomainError('BRAND_ARCHIVED', 'Brand archived', 409, 'errors.brand_archived');
    const c = await this.workdrive.requireClient(ctx.tenantId);
    const organizationScope = b.scope === 'organization';
    const brandFolderId = await this.brandFolderFor(c, brand);
    const startFolderId =
      organizationScope && c.conn.rootFolderId ? c.conn.rootFolderId : brandFolderId;
    const parentId = typeof b.parent_id === 'string' && b.parent_id ? b.parent_id : startFolderId;
    try {
      await this.assertInsideScope(c.client, parentId, startFolderId);
      const created = await c.client.ensurePath([name], parentId);
      this.folderCache.clear();
      await this.audit.write({
        actorUserId: ctx.userId,
        tenantId: ctx.tenantId,
        action: 'media.folder_created',
        targetType: 'WorkDriveFolder',
        targetId: created.folderId,
        afterRef: name,
        correlationId: ctx.correlationId,
      });
      return {
        data: {
          id: created.folderId,
          name,
          parent_id: parentId,
          path: created.path,
        },
      };
    } catch (e) {
      throw workDriveDomainError(e);
    }
  }

  /** Signed preview for a WorkDrive file that may not yet be imported as a MediaAsset. */
  async filePreview(tenantId: string, brandId: string, fileId: string) {
    if (!fileId || fileId.length > 80) throw notFound();
    const brand = await this.brand(tenantId, brandId);
    const c = await this.workdrive.requireClient(tenantId);
    try {
      const d = await c.client.details(fileId);
      const scopeRootId = c.conn.rootFolderId || (await this.brandFolderFor(c, brand));
      if (d.folderId) await this.assertInsideScope(c.client, d.folderId, scopeRootId);
      const signed = await c.client.previewUrl(fileId);
      return { url: signed.url, expires_at: signed.expiresAt.toISOString() };
    } catch (e) {
      if (e instanceof WorkDriveError && e.code === 'not_found') throw notFound();
      throw workDriveDomainError(e);
    }
  }

  async getAsset(tenantId: string, assetId: string) {
    const a = await getPrisma().mediaAsset.findFirst({
      where: tenantWhere(tenantId, { id: assetId }),
    });
    if (!a) throw notFound();
    return a;
  }

  private async markMissing(a: Asset, missing: boolean) {
    if ((a.status === 'MISSING') === missing) {
      await getPrisma().mediaAsset.update({
        where: { id: a.id },
        data: { lastCheckedAt: new Date() },
      });
      return;
    }
    await getPrisma().mediaAsset.update({
      where: { id: a.id },
      data: missing
        ? { status: 'MISSING', missingSince: new Date(), lastCheckedAt: new Date() }
        : { status: 'READY', missingSince: null, lastCheckedAt: new Date() },
    });
  }

  /** Details + a live existence check (WorkDrive deletions surface as `missing`, never deleted here). */
  async details(tenantId: string, assetId: string) {
    const a = await this.getAsset(tenantId, assetId);
    let c: Awaited<ReturnType<WorkDriveService['clientForAsset']>> | null = null;
    try {
      c = await this.workdrive.clientForAsset(tenantId, a);
    } catch {
      c = null;
    }
    if (c) {
      try {
        await c.client.details(a.workdriveFileId);
        await this.markMissing(a, false);
      } catch (e) {
        if (e instanceof WorkDriveError && e.code === 'not_found') await this.markMissing(a, true);
        else throw workDriveDomainError(e);
      }
    }
    return {
      data: { ...mapAsset(await this.getAsset(tenantId, assetId)), workdrive_connected: !!c },
    };
  }

  /**
   * Fresh signed URL (preview = inline bytes with the stored MIME and HTTP Range, download =
   * attachment). Always checked against WorkDrive so removed files / disconnects show at once;
   * repeat loads are absorbed by the browser caching the `/view` / `/stream` redirect.
   */
  async signedUrl(tenantId: string, assetId: string, mode: 'preview' | 'download') {
    const a = await this.getAsset(tenantId, assetId);
    // Local/demo fixtures: workdriveFileId "demo:<seed>" serves a stable public image so
    // carousel / story / reel screenshots work without a live WorkDrive connection.
    if (a.workdriveFileId.startsWith('demo:')) {
      const seed = encodeURIComponent(a.workdriveFileId.slice('demo:'.length) || a.id);
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      const isVideo = a.mime.startsWith('video/');
      const url = isVideo
        ? `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`
        : `https://picsum.photos/seed/${seed}/900/1200`;
      return { url, expires_at: expires.toISOString(), mime: a.mime };
    }
    const { client } = await this.workdrive.clientForAsset(tenantId, a);
    try {
      const s =
        mode === 'download'
          ? await client.downloadUrl(a.workdriveFileId)
          : await client.previewUrl(a.workdriveFileId);
      if (a.status === 'MISSING') await this.markMissing(a, false);
      return { url: s.url, expires_at: s.expiresAt.toISOString(), mime: a.mime };
    } catch (e) {
      if (e instanceof WorkDriveError && e.code === 'not_found') {
        await this.markMissing(a, true);
        throw new DomainError(
          'MEDIA_MISSING',
          'File was removed from WorkDrive',
          410,
          'errors.media_missing',
        );
      }
      throw workDriveDomainError(e);
    }
  }

  async stream(tenantId: string, assetId: string, range: string | undefined) {
    const a = await this.getAsset(tenantId, assetId);
    const { client } = await this.workdrive.clientForAsset(tenantId, a);
    try {
      const up = await client.stream(a.workdriveFileId, range);
      return Object.assign(up, { assetMime: a.mime });
    } catch (e) {
      if (e instanceof WorkDriveError && e.code === 'not_found') {
        await this.markMissing(a, true);
        throw new DomainError(
          'MEDIA_MISSING',
          'File was removed from WorkDrive',
          410,
          'errors.media_missing',
        );
      }
      throw workDriveDomainError(e);
    }
  }

  /** Validates that an asset can be attached to an entity of `brandId`. */
  async assertAttachable(tenantId: string, brandId: string, assetId: unknown, kinds: MediaKind[]) {
    if (typeof assetId !== 'string' || !assetId) throw bad('asset id required');
    const a = await getPrisma().mediaAsset.findFirst({
      where: tenantWhere(tenantId, { id: assetId, brandId }),
    });
    if (!a || !kinds.includes(a.kind as MediaKind)) throw notFound();
    return a;
  }
}
