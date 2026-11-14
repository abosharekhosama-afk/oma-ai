import { createHash } from 'node:crypto';
import { getPrisma } from '@oma/db';
import {
  allowedMimeFor,
  assertSsrfAllowed,
  brandFolderSlug,
  clientFromConnection,
  IMAGE_MIME,
  maxBytesForMime,
  mediaFolderSegments,
  newId,
  safeFileName,
  VIDEO_MIME,
  workDriveSecretKey,
  type ExtractedProductMedia,
  type FetchLike,
} from '@oma/domain';

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

function extForMime(mime: string, fallback = 'bin'): string {
  return EXT[mime.toLowerCase()] ?? fallback;
}

function mimeFromUrl(url: string): string | null {
  const lower = url.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return null;
}

async function clientForTenant(tenantId: string, fetchImpl?: FetchLike) {
  const key = workDriveSecretKey();
  if (!key) return null;
  const conn = await getPrisma().workDriveConnection.findUnique({ where: { tenantId } });
  if (!conn || conn.status !== 'CONNECTED') return null;
  return { conn, client: clientFromConnection(conn, key, fetchImpl) };
}

export async function ingestProductMediaFromScan(input: {
  tenantId: string;
  brandId: string;
  brandName: string;
  discoveredProductId: string;
  productName: string;
  media: ExtractedProductMedia[];
  fetchImpl?: FetchLike;
}) {
  if (!input.media.length) return { imported: 0, skipped: 0 };
  const c = await clientForTenant(input.tenantId, input.fetchImpl);
  if (!c) return { imported: 0, skipped: input.media.length };

  const fetchImpl = input.fetchImpl ?? fetch;
  const prisma = getPrisma();
  const brandSlug = brandFolderSlug(input.brandName, input.brandId.slice(-8).toLowerCase());
  const { folderId } = await c.client.ensurePath(
    mediaFolderSegments({
      brandSlug,
      kind: 'catalog',
      rootFolderName: c.conn.rootFolderName,
    }),
  );

  let imported = 0;
  let skipped = 0;
  let sortOrder = 0;
  let hasThumbnail = Boolean(
    await prisma.catalogProductMedia.findFirst({
      where: {
        tenantId: input.tenantId,
        discoveredProductId: input.discoveredProductId,
        role: 'SCAN_THUMBNAIL',
      },
    }),
  );

  for (const item of input.media) {
    let parsed: URL;
    try {
      parsed = new URL(item.url);
    } catch {
      skipped++;
      continue;
    }
    if (parsed.protocol !== 'https:') {
      skipped++;
      continue;
    }
    try {
      assertSsrfAllowed(parsed.hostname);
    } catch {
      skipped++;
      continue;
    }

    let res: Response;
    try {
      res = await fetchImpl(item.url, {
        method: 'GET',
        headers: { Accept: 'image/*,video/*' },
        redirect: 'follow',
      });
    } catch {
      skipped++;
      continue;
    }
    if (!res.ok) {
      skipped++;
      continue;
    }
    const mimeHeader = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    const mime =
      (item.kind === 'VIDEO' ? VIDEO_MIME : IMAGE_MIME).find((m) => mimeHeader.startsWith(m)) ??
      mimeFromUrl(item.url);
    if (!mime || !allowedMimeFor('catalog').includes(mime)) {
      skipped++;
      continue;
    }
    const max = maxBytesForMime(mime);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length <= 0 || buf.length > max) {
      skipped++;
      continue;
    }
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const existingAsset = await prisma.mediaAsset.findFirst({
      where: { tenantId: input.tenantId, brandId: input.brandId, kind: 'catalog', sha256 },
    });
    let assetId = existingAsset?.id;
    if (!assetId) {
      const base = safeFileName(`${input.productName}-${sha256.slice(0, 8)}.${extForMime(mime)}`);
      const uploaded = await c.client.upload({
        folderId,
        name: base,
        mimeType: mime,
        sha256,
        source: {
          size: buf.length,
          full: () => buf,
          part: async (s, e) => buf.subarray(s, e),
        },
      });
      const row = await prisma.mediaAsset.create({
        data: {
          id: newId(),
          tenantId: input.tenantId,
          brandId: input.brandId,
          kind: 'catalog',
          workdriveFileId: uploaded.fileId,
          folderId,
          storageProvider: 'USER_WORKDRIVE',
          name: uploaded.name,
          mime,
          size: BigInt(buf.length),
          sha256,
          source: 'migrated',
          lastCheckedAt: new Date(),
          createdBy: 'system',
        },
      });
      assetId = row.id;
    }

    const role =
      item.kind === 'VIDEO' ? 'SCAN_VIDEO' : !hasThumbnail ? 'SCAN_THUMBNAIL' : 'SCAN_IMAGE';
    if (role === 'SCAN_THUMBNAIL') hasThumbnail = true;

    try {
      await prisma.catalogProductMedia.create({
        data: {
          id: newId(),
          tenantId: input.tenantId,
          brandId: input.brandId,
          discoveredProductId: input.discoveredProductId,
          mediaAssetId: assetId,
          role,
          sourceUrl: item.url,
          sortOrder: sortOrder++,
        },
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped };
}
