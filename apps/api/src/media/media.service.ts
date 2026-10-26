import { createHash } from 'node:crypto';
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
  mediaFolderSegments,
  newId,
  safeFileName,
  WorkDriveClient,
  WorkDriveError,
  type MediaKind,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { workDriveDomainError, WorkDriveService } from './workdrive.service';

type Asset = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getPrisma>['mediaAsset']['findFirst']>>
>;

const notFound = () => new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
const bad = (msg: string, key = 'errors.validation_failed') =>
  new DomainError('VALIDATION_FAILED', msg, 400, key);

export const mediaViewUrl = (id: string) => `/api/v1/media/${id}/view`;

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
    view_url: mediaViewUrl(a.id),
    stream_url: a.mime.startsWith('video/') ? `/api/v1/media/${a.id}/stream` : null,
    created_at: a.createdAt.toISOString(),
  };
}

function parseKind(v: unknown): MediaKind {
  if (!isMediaKind(v)) throw bad('kind must be posts, logos or deliverables');
  return v;
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

  private async folderFor(
    c: { client: WorkDriveClient; conn: { id: string; rootFolderName: string | null } },
    brand: { id: string; name: string },
    kind: MediaKind,
  ) {
    const segs = mediaFolderSegments({
      brandSlug: brandFolderSlug(brand.name, brand.id.slice(-8).toLowerCase()),
      kind,
      rootFolderName: c.conn.rootFolderName,
    });
    const k = `${c.conn.id}:${segs.join('/')}`;
    const hit = this.folderCache.get(k);
    if (hit) return hit;
    const { folderId } = await c.client.ensurePath(segs);
    this.folderCache.set(k, folderId);
    return folderId;
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
    input: { kind: unknown; name: unknown; mime: unknown; length: number | null; body: Readable },
  ) {
    const kind = parseKind(input.kind);
    this.assertCapability(ctx.capabilities, kind);
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
    const c = await this.workdrive.requireClient(ctx.tenantId);

    const dir = await mkdtemp(join(tmpdir(), 'oma-upload-'));
    const path = join(dir, 'body');
    try {
      const m = meter(max);
      await pipeline(input.body, m.t, createWriteStream(path));
      const { size, sha256 } = m.result();
      if (!size) throw bad('Empty file', 'errors.media_empty');
      if (input.length != null && size !== input.length)
        throw bad('Upload was interrupted', 'errors.media_interrupted');

      let fileId: string;
      let storedName = name;
      let folderId: string;
      try {
        folderId = await this.folderFor(c, brand, kind);
        const fh = await open(path, 'r');
        try {
          ({ fileId, name: storedName } = await c.client.upload({
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
          }));
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

  /** Browse WorkDrive folders for the picker. Starts at the brand folder; never above the key root. */
  async browse(tenantId: string, brandId: string, q: { folder_id?: string; kind?: string }) {
    const brand = await this.brand(tenantId, brandId);
    const kind = q.kind ? parseKind(q.kind) : 'posts';
    const c = await this.workdrive.requireClient(tenantId);
    try {
      const brandFolderId = q.folder_id || (await this.folderFor(c, brand, kind));
      const f = await c.client.getFolder(brandFolderId);
      const allowed = allowedMimeFor(kind);
      const atRoot = !!c.conn.rootFolderId && f.id === c.conn.rootFolderId;
      return {
        data: {
          folder: { id: f.id, name: f.name, parent_id: atRoot ? null : f.parentId },
          root_name: c.conn.rootFolderName,
          folders: f.folders,
          files: f.files
            .filter((x) => allowed.includes(x.mimeType))
            .map((x) => ({
              id: x.id,
              name: x.name,
              mime: x.mimeType,
              size: x.size,
              updated_at: x.updatedAt,
            })),
        },
      };
    } catch (e) {
      if (e instanceof WorkDriveError && e.code === 'not_found' && q.folder_id) throw notFound();
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
    const c = await this.workdrive.clientFor(tenantId);
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

  /** Fresh signed URL (preview = inline, download = attachment). */
  async signedUrl(tenantId: string, assetId: string, mode: 'preview' | 'download') {
    const a = await this.getAsset(tenantId, assetId);
    const { client } = await this.workdrive.requireClient(tenantId);
    try {
      const s =
        mode === 'download'
          ? await client.downloadUrl(a.workdriveFileId)
          : await client.previewUrl(a.workdriveFileId);
      if (a.status === 'MISSING') await this.markMissing(a, false);
      return { url: s.url, expires_at: s.expiresAt.toISOString(), asset: a };
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
    const { client } = await this.workdrive.requireClient(tenantId);
    try {
      return await client.stream(a.workdriveFileId, range);
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
