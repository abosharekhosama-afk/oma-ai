import { createHash } from 'node:crypto';
import { getPrisma } from '@oma/db';
import {
  brandFolderSlug,
  clientFromConnection,
  IMAGE_MIME,
  mediaFolderSegments,
  newId,
  SocialProviderError,
  WorkDriveError,
  workDriveSecretKey,
  type FetchLike,
} from '@oma/domain';

type Deps = { now?: () => Date; key?: Buffer | null; fetchImpl?: FetchLike; limit?: number };

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** data:image/...;base64,... → bytes (null when not a supported image data URL). */
export function decodeImageDataUrl(url: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(url);
  if (!m) return null;
  const mime = m[1]!.toLowerCase();
  if (!IMAGE_MIME.includes(mime)) return null;
  const bytes = Buffer.from(m[2]!.replace(/\s+/g, ''), 'base64');
  return bytes.length ? { mime, bytes } : null;
}

async function clientForTenant(tenantId: string, key: Buffer, fetchImpl?: FetchLike) {
  const conn = await getPrisma().workDriveConnection.findUnique({ where: { tenantId } });
  if (!conn || conn.status !== 'CONNECTED') return null;
  return { conn, client: clientFromConnection(conn, key, fetchImpl) };
}

/**
 * Moves data-URL brand logos into the tenant's WorkDrive (`…/{brand}/logos`).
 * Idempotent: the file name is derived from the content hash, an existing MediaAsset or WorkDrive
 * file with that hash is reused, and the brand row only switches over if its logo is unchanged.
 */
export async function runLogoMigrationTick(deps: Deps = {}) {
  const key = deps.key === undefined ? workDriveSecretKey() : deps.key;
  const out = { scanned: 0, migrated: 0, reused: 0, skipped: 0, failed: 0 };
  if (!key) return out;
  const prisma = getPrisma();
  const tenants = (
    await prisma.workDriveConnection.findMany({
      where: { status: 'CONNECTED' },
      select: { tenantId: true },
    })
  ).map((t) => t.tenantId);
  if (!tenants.length) return out;
  const brands = await prisma.brandWorkspace.findMany({
    where: {
      tenantId: { in: tenants },
      logoAssetId: null,
      logoUrl: { startsWith: 'data:' },
      deletedAt: null,
    },
    select: { id: true, tenantId: true, name: true, logoUrl: true },
    take: deps.limit ?? 25,
    orderBy: { id: 'asc' },
  });
  for (const b of brands) {
    out.scanned++;
    const decoded = decodeImageDataUrl(b.logoUrl!);
    if (!decoded) {
      out.skipped++;
      continue;
    }
    try {
      const c = await clientForTenant(b.tenantId, key, deps.fetchImpl);
      if (!c) {
        out.skipped++;
        continue;
      }
      const sha256 = createHash('sha256').update(decoded.bytes).digest('hex');
      let asset = await prisma.mediaAsset.findFirst({
        where: { tenantId: b.tenantId, brandId: b.id, kind: 'logos', sha256, status: 'READY' },
      });
      if (asset) out.reused++;
      else {
        const name = `logo-${sha256.slice(0, 12)}.${EXT[decoded.mime]}`;
        const { folderId } = await c.client.ensurePath(
          mediaFolderSegments({
            brandSlug: brandFolderSlug(b.name, b.id.slice(-8).toLowerCase()),
            kind: 'logos',
            rootFolderName: c.conn.rootFolderName,
          }),
        );
        // A previous run may have uploaded the file and crashed before recording it.
        const existing = (await c.client.getFolder(folderId)).files.find(
          (f) => f.name === name && f.size === decoded.bytes.length,
        );
        const fileId =
          existing?.id ??
          (
            await c.client.upload({
              folderId,
              name,
              mimeType: decoded.mime,
              sha256,
              source: {
                size: decoded.bytes.length,
                full: () => decoded.bytes,
                part: async (s, e) => decoded.bytes.subarray(s, e),
              },
            })
          ).fileId;
        asset = await prisma.mediaAsset.upsert({
          where: {
            tenantId_brandId_workdriveFileId: {
              tenantId: b.tenantId,
              brandId: b.id,
              workdriveFileId: fileId,
            },
          },
          create: {
            id: newId(),
            tenantId: b.tenantId,
            brandId: b.id,
            kind: 'logos',
            workdriveFileId: fileId,
            folderId,
            name,
            mime: decoded.mime,
            size: BigInt(decoded.bytes.length),
            sha256,
            source: 'migrated',
            lastCheckedAt: deps.now?.() ?? new Date(),
            createdBy: 'system',
          },
          update: { status: 'READY', missingSince: null },
        });
        if (existing) out.reused++;
      }
      // Only switch if nobody changed the logo meanwhile.
      const res = await prisma.brandWorkspace.updateMany({
        where: { id: b.id, logoUrl: b.logoUrl, logoAssetId: null },
        data: { logoAssetId: asset.id, logoUrl: `/api/v1/media/${asset.id}/view` },
      });
      if (res.count) {
        out.migrated++;
        await prisma.auditEvent
          .create({
            data: {
              id: newId(),
              tenantId: b.tenantId,
              actorType: 'system',
              action: 'brand.logo_migrated',
              targetType: 'BrandWorkspace',
              targetId: b.id,
              afterRef: asset.id,
            },
          })
          .catch(() => undefined);
      } else out.skipped++;
    } catch {
      out.failed++;
    }
  }
  return out;
}

/** Marks media removed in WorkDrive as MISSING (and back to READY if restored). Never deletes. */
export async function runMediaReconcileTick(deps: Deps = {}) {
  const key = deps.key === undefined ? workDriveSecretKey() : deps.key;
  const out = { checked: 0, missing: 0, restored: 0 };
  if (!key) return out;
  const now = deps.now?.() ?? new Date();
  const prisma = getPrisma();
  const stale = new Date(now.getTime() - 24 * 3600_000);
  const rows = await prisma.mediaAsset.findMany({
    where: { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: stale } }] },
    take: deps.limit ?? 50,
    orderBy: { lastCheckedAt: 'asc' },
  });
  const clients = new Map<string, Awaited<ReturnType<typeof clientForTenant>>>();
  for (const a of rows) {
    if (!clients.has(a.tenantId))
      clients.set(a.tenantId, await clientForTenant(a.tenantId, key, deps.fetchImpl));
    const c = clients.get(a.tenantId);
    if (!c) continue;
    out.checked++;
    try {
      await c.client.details(a.workdriveFileId);
      if (a.status === 'MISSING') out.restored++;
      await prisma.mediaAsset.update({
        where: { id: a.id },
        data: { status: 'READY', missingSince: null, lastCheckedAt: now },
      });
    } catch (e) {
      if (e instanceof WorkDriveError && e.code === 'not_found') {
        if (a.status !== 'MISSING') out.missing++;
        await prisma.mediaAsset.update({
          where: { id: a.id },
          data: { status: 'MISSING', missingSince: a.missingSince ?? now, lastCheckedAt: now },
        });
      }
    }
  }
  return out;
}

async function signedUrlForAsset(
  assetId: string,
  tenantId: string,
  deps: { key?: Buffer | null; fetchImpl?: FetchLike },
): Promise<string> {
  const key = deps.key === undefined ? workDriveSecretKey() : deps.key;
  const asset = await getPrisma().mediaAsset.findFirst({
    where: { id: assetId, tenantId },
  });
  if (!asset) throw new SocialProviderError('The post media was removed', { retryable: false });
  const c = key ? await clientForTenant(tenantId, key, deps.fetchImpl) : null;
  if (!c) throw new SocialProviderError('WorkDrive is not connected', { retryable: true });
  try {
    return (await c.client.previewUrl(asset.workdriveFileId)).url;
  } catch (e) {
    if (e instanceof WorkDriveError && e.code === 'not_found') {
      await getPrisma().mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: 'MISSING',
          missingSince: asset.missingSince ?? new Date(),
          lastCheckedAt: new Date(),
        },
      });
      throw new SocialProviderError('The post media was removed from WorkDrive', {
        retryable: false,
      });
    }
    throw new SocialProviderError(`WorkDrive: ${(e as Error).message}`, { retryable: true });
  }
}

/**
 * Public URLs a social network can fetch for a post's media (carousel order preserved).
 * WorkDrive assets get fresh signed URLs; legacy https preview URLs are included when no assets.
 */
export async function publicMediaUrls(
  item: {
    tenantId: string;
    previewAssetId: string | null;
    previewAssetUrl: string | null;
    mediaAssetIds?: string[];
  },
  deps: { key?: Buffer | null; fetchImpl?: FetchLike } = {},
): Promise<string[]> {
  const ids =
    (item.mediaAssetIds?.length ?? 0) > 0
      ? item.mediaAssetIds!.filter(Boolean)
      : item.previewAssetId
        ? [item.previewAssetId]
        : [];
  const out: string[] = [];
  for (const id of ids) {
    out.push(await signedUrlForAsset(id, item.tenantId, deps));
  }
  if (!out.length) {
    const u = item.previewAssetUrl;
    if (u && /^https:\/\//.test(u)) out.push(u);
  }
  return out;
}

/**
 * First public media URL (compatibility helper).
 */
export async function publicMediaUrl(
  item: {
    tenantId: string;
    previewAssetId: string | null;
    previewAssetUrl: string | null;
    mediaAssetIds?: string[];
  },
  deps: { key?: Buffer | null; fetchImpl?: FetchLike } = {},
): Promise<string | null> {
  const urls = await publicMediaUrls(item, deps);
  return urls[0] ?? null;
}

/**
 * TikTok validates the URL prefix before it downloads PULL_FROM_URL media. Route WorkDrive's
 * signed URL through the public OMA web origin so the verified Vercel hostname is the prefix.
 */
export function mediaProxyUrl(
  sourceUrl: string,
  origin = process.env.MEDIA_PROXY_ORIGIN ||
    process.env.WEB_ORIGIN ||
    process.env.WEB_BASE_URL ||
    'https://oma-ai-ecru.vercel.app',
): string {
  const source = new URL(sourceUrl);
  if (source.protocol !== 'https:') throw new Error('Media proxy source must use HTTPS');
  const proxy = new URL('/api/media-proxy', origin.replace(/\/+$/, ''));
  proxy.searchParams.set('url', source.toString());
  return proxy.toString();
}

export function startMediaJobs(log: { error: (o: unknown, m: string) => void }) {
  const every = Number(process.env.WORKDRIVE_MIGRATION_INTERVAL_MS ?? 10 * 60_000);
  const run = () => {
    runLogoMigrationTick().catch((e) =>
      log.error({ err: String(e) }, 'logo migration tick failed'),
    );
    runMediaReconcileTick().catch((e) =>
      log.error({ err: String(e) }, 'media reconcile tick failed'),
    );
  };
  const t = setInterval(run, every);
  const first = setTimeout(run, 15_000);
  return () => {
    clearInterval(t);
    clearTimeout(first);
  };
}
