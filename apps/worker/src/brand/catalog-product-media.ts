import { createHash } from 'node:crypto';
import {
  enqueueStorageBackupIfNeeded,
  getPrisma,
  resolveStorageWriteTarget,
  uploadToStorageTarget,
} from '@oma/db';
import {
  allowedMimeFor,
  assertSsrfAllowed,
  DomainError,
  IMAGE_MIME,
  maxBytesForMime,
  mediaIdentityKey,
  newId,
  safeFileName,
  VIDEO_MIME,
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

/** Scan media follows the workspace storage setting (OMA storage unless WorkDrive is selected). */
async function writeTargetForTenant(tenantId: string, fetchImpl?: FetchLike) {
  try {
    return await resolveStorageWriteTarget(tenantId, { fetchImpl });
  } catch {
    return null;
  }
}

type ScanRole = 'SCAN_THUMBNAIL' | 'SCAN_IMAGE' | 'SCAN_VIDEO';

const SCAN_ROLES: ScanRole[] = ['SCAN_THUMBNAIL', 'SCAN_IMAGE', 'SCAN_VIDEO'];

/** Images smaller than this are icons/trackers, not product photos. */
const MIN_IMAGE_BYTES = 1_024;

export type ScanMediaSyncResult = {
  imported: number;
  kept: number;
  removed: number;
  skipped: number;
};

/**
 * Makes a product's scanned media exactly match `media` (already curated, in display order):
 * missing items are downloaded into WorkDrive, items no longer attributed to the product are
 * unlinked, and order/thumbnail are rewritten. Only SCAN_* links are touched — generated and
 * human-reviewed media are never removed. Idempotent: a second run with the same list is a no-op.
 */
export async function syncProductScanMedia(input: {
  tenantId: string;
  brandId: string;
  brandName: string;
  discoveredProductId: string;
  productName: string;
  media: ExtractedProductMedia[];
  fetchImpl?: FetchLike;
}): Promise<ScanMediaSyncResult> {
  const prisma = getPrisma();
  const result: ScanMediaSyncResult = { imported: 0, kept: 0, removed: 0, skipped: 0 };
  const existing = await prisma.catalogProductMedia.findMany({
    where: {
      tenantId: input.tenantId,
      discoveredProductId: input.discoveredProductId,
      role: { in: SCAN_ROLES },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  // Desired list, de-duplicated by CDN-insensitive identity.
  const desired: Array<ExtractedProductMedia & { key: string }> = [];
  const desiredKeys = new Set<string>();
  for (const item of input.media) {
    const key = mediaIdentityKey(item.url);
    if (!key || desiredKeys.has(key)) continue;
    desiredKeys.add(key);
    desired.push({ ...item, key });
  }

  // Unlink scan media that is no longer attributed to this product (and duplicate links).
  const keptByKey = new Map<string, (typeof existing)[number]>();
  for (const link of existing) {
    const key = link.sourceUrl ? mediaIdentityKey(link.sourceUrl) : null;
    if (key && desiredKeys.has(key) && !keptByKey.has(key)) {
      keptByKey.set(key, link);
      continue;
    }
    await prisma.catalogProductMedia.delete({ where: { id: link.id } }).catch(() => undefined);
    result.removed++;
  }

  const c = desired.some((d) => !keptByKey.has(d.key))
    ? await writeTargetForTenant(input.tenantId, input.fetchImpl)
    : null;
  const fetchImpl = input.fetchImpl ?? fetch;
  const brand = { id: input.brandId, name: input.brandName };

  let sortOrder = 0;
  let hasThumbnail = false;
  for (const item of desired) {
    const role: ScanRole =
      item.kind === 'VIDEO' ? 'SCAN_VIDEO' : hasThumbnail ? 'SCAN_IMAGE' : 'SCAN_THUMBNAIL';
    const kept = keptByKey.get(item.key);
    if (kept) {
      if (role === 'SCAN_THUMBNAIL') hasThumbnail = true;
      if (kept.role !== role || kept.sortOrder !== sortOrder) {
        await prisma.catalogProductMedia
          .update({ where: { id: kept.id }, data: { role, sortOrder } })
          .catch(() => undefined);
      }
      sortOrder++;
      result.kept++;
      continue;
    }
    if (!c) {
      result.skipped++;
      continue;
    }
    let assetId: string | null;
    try {
      assetId = await importAsset({
        tenantId: input.tenantId,
        brandId: input.brandId,
        productName: input.productName,
        item,
        fetchImpl,
        upload: (args) =>
          uploadToStorageTarget({
            target: c,
            brand,
            kind: 'catalog',
            name: args.name,
            mime: args.mimeType,
            bytes: args.source.full(),
            sha256: args.sha256,
          }),
      });
    } catch (e) {
      // Over the OMA storage quota: keep the product, skip storing more media.
      if (e instanceof DomainError && e.code === 'PLAN_LIMIT_REACHED') {
        result.skipped++;
        continue;
      }
      throw e;
    }
    if (!assetId) {
      result.skipped++;
      continue;
    }
    try {
      await prisma.catalogProductMedia.create({
        data: {
          id: newId(),
          tenantId: input.tenantId,
          brandId: input.brandId,
          discoveredProductId: input.discoveredProductId,
          mediaAssetId: assetId,
          role,
          reviewStatus: 'APPROVED',
          sourceUrl: item.url,
          sortOrder: sortOrder++,
        },
      });
      if (role === 'SCAN_THUMBNAIL') hasThumbnail = true;
      result.imported++;
    } catch {
      result.skipped++;
    }
  }
  return result;
}

type UploadArgs = {
  name: string;
  mimeType: string;
  sha256: string;
  source: {
    size: number;
    full: () => Buffer;
    part: (s: number, e: number) => Promise<Buffer>;
  };
};

/** Downloads one public media URL and stores it (de-duplicated by content hash). */
async function importAsset(input: {
  tenantId: string;
  brandId: string;
  productName: string;
  item: ExtractedProductMedia;
  fetchImpl: FetchLike;
  upload: (args: UploadArgs) => Promise<{
    fileId: string;
    name: string;
    folderId: string;
    storageProvider: 'OMA_INTERNAL' | 'USER_WORKDRIVE';
    storagePath: string | null;
  }>;
}): Promise<string | null> {
  const prisma = getPrisma();
  const { item } = input;
  let parsed: URL;
  try {
    parsed = new URL(item.url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  try {
    assertSsrfAllowed(parsed.hostname);
  } catch {
    return null;
  }
  let res: Response;
  try {
    res = await input.fetchImpl(item.url, {
      method: 'GET',
      headers: { Accept: 'image/*,video/*' },
      redirect: 'follow',
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const mimeHeader = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
  const mime =
    (item.kind === 'VIDEO' ? VIDEO_MIME : IMAGE_MIME).find((m) => mimeHeader.startsWith(m)) ??
    mimeFromUrl(item.url);
  if (!mime || !allowedMimeFor('catalog').includes(mime)) return null;
  const max = maxBytesForMime(mime);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length <= 0 || buf.length > max) return null;
  if (mime.startsWith('image/') && buf.length < MIN_IMAGE_BYTES) return null;
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const existingAsset = await prisma.mediaAsset.findFirst({
    where: { tenantId: input.tenantId, brandId: input.brandId, kind: 'catalog', sha256 },
  });
  if (existingAsset) return existingAsset.id;
  const base = safeFileName(`${input.productName}-${sha256.slice(0, 8)}.${extForMime(mime)}`);
  const uploaded = await input.upload({
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
      folderId: uploaded.folderId,
      storageProvider: uploaded.storageProvider,
      storagePath: uploaded.storagePath,
      name: uploaded.name,
      mime,
      size: BigInt(buf.length),
      sha256,
      source: 'migrated',
      lastCheckedAt: new Date(),
      createdBy: 'system',
    },
  });
  await enqueueStorageBackupIfNeeded(row);
  return row.id;
}
