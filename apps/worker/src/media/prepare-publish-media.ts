/**
 * Download → optional sharp transcode/resize → re-upload WorkDrive publish variant.
 * Ensures TikTok (and similar) get JPEG/WebP ≤1080p before PULL_FROM_URL.
 */
import { createHash } from 'node:crypto';
import {
  enqueueStorageBackupIfNeeded,
  getPrisma,
  resolveStorageWriteTarget,
  storageTargetForAsset,
  uploadToStorageTarget,
} from '@oma/db';
import {
  DomainError,
  imageNeedsTranscode,
  newId,
  NETWORK_MEDIA_CONSTRAINTS,
  SocialProviderError,
  type FetchLike,
  type SocialNetworkKey,
} from '@oma/domain';

export type PreparedMedia = { url: string; mime: string; sizeBytes: number };

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch (e) {
    throw new SocialProviderError(
      `Image transcoding is unavailable (sharp): ${(e as Error).message}`,
      { retryable: false },
    );
  }
}

async function fetchBytes(url: string, fetchImpl: FetchLike): Promise<Buffer> {
  const res = await fetchImpl(url, { method: 'GET' });
  if (!res.ok) {
    throw new SocialProviderError(`Failed to download media (${res.status})`, { retryable: true });
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function prepareAssetForNetwork(input: {
  tenantId: string;
  brandId: string;
  brandName: string;
  assetId: string;
  network: string;
  sourceUrl: string;
  mime: string;
  sizeBytes: number;
  fetchImpl?: FetchLike;
}): Promise<PreparedMedia> {
  const network = input.network.toLowerCase() as SocialNetworkKey;
  const constraints = NETWORK_MEDIA_CONSTRAINTS[network];
  const fetchImpl = input.fetchImpl ?? ((u, i) => fetch(u, i));
  const mime = input.mime.toLowerCase().split(';')[0]!.trim();

  if (mime.startsWith('video/')) {
    if (constraints && !constraints.videoMimes.includes(mime)) {
      throw new SocialProviderError(
        `${network} [file_format_check_failed]: unsupported video MIME ${mime}. Use ${constraints.videoMimes.join(', ')}.`,
        { retryable: false },
      );
    }
    if (constraints && input.sizeBytes > constraints.maxVideoBytes) {
      throw new SocialProviderError(`${network}: video exceeds size limit.`, { retryable: false });
    }
    return { url: input.sourceUrl, mime, sizeBytes: input.sizeBytes };
  }

  if (!mime.startsWith('image/')) {
    throw new SocialProviderError(`${network}: unsupported media type ${mime}`, {
      retryable: false,
    });
  }

  const bytes = await fetchBytes(input.sourceUrl, fetchImpl);
  const sharp = await loadSharp();
  const meta = await sharp(bytes).metadata();
  const width = meta.width ?? null;
  const height = meta.height ?? null;
  const needs = imageNeedsTranscode(network, mime, width, height);

  if (!needs) {
    return { url: input.sourceUrl, mime, sizeBytes: bytes.length };
  }

  const maxEdge = constraints?.maxPhotoEdgePx ?? 1080;
  let pipeline = sharp(bytes).rotate();
  if (width && height && Math.max(width, height) > maxEdge) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  let out = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  const maxBytes = constraints?.maxPhotoBytes ?? 20 * 1024 * 1024;
  if (out.length > maxBytes) {
    out = await sharp(out).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
  }
  if (out.length > maxBytes) {
    throw new SocialProviderError(
      `${network} [picture_size_check_failed]: photo still exceeds ${Math.round(maxBytes / (1024 * 1024))} MB after compression.`,
      { retryable: false },
    );
  }

  return uploadVariant({
    tenantId: input.tenantId,
    brandId: input.brandId,
    brandName: input.brandName,
    assetId: input.assetId,
    network,
    bytes: out,
    mime: 'image/jpeg',
    fetchImpl,
  });
}

async function uploadVariant(input: {
  tenantId: string;
  brandId: string;
  brandName: string;
  assetId: string;
  network: string;
  bytes: Buffer;
  mime: string;
  fetchImpl: FetchLike;
}): Promise<PreparedMedia> {
  const sha256 = createHash('sha256').update(input.bytes).digest('hex');
  const name = `pub-${input.network}-${input.assetId.slice(-8)}-${sha256.slice(0, 10)}.jpg`;

  const existing = await getPrisma().mediaAsset.findFirst({
    where: {
      tenantId: input.tenantId,
      brandId: input.brandId,
      kind: 'posts',
      sha256,
      status: 'READY',
    },
  });
  if (existing) {
    const reader = await storageTargetForAsset(input.tenantId, existing, {
      fetchImpl: input.fetchImpl,
    });
    const url = (await reader.client.downloadUrl(existing.workdriveFileId)).url;
    return { url, mime: existing.mime, sizeBytes: Number(existing.size) };
  }

  // Publish variants follow the workspace storage setting like every other write.
  let target;
  try {
    target = await resolveStorageWriteTarget(input.tenantId, { fetchImpl: input.fetchImpl });
  } catch (e) {
    throw new SocialProviderError(
      e instanceof DomainError ? e.message : 'Media storage is not available',
      { retryable: true },
    );
  }
  let uploaded;
  try {
    uploaded = await uploadToStorageTarget({
      target,
      brand: { id: input.brandId, name: input.brandName },
      kind: 'posts',
      name,
      mime: input.mime,
      bytes: input.bytes,
      sha256,
    });
  } catch (e) {
    if (e instanceof DomainError && e.code === 'PLAN_LIMIT_REACHED') {
      throw new SocialProviderError(`Storage limit reached: ${e.message}`, { retryable: false });
    }
    throw e;
  }
  const row = await getPrisma().mediaAsset.upsert({
    where: {
      tenantId_brandId_workdriveFileId: {
        tenantId: input.tenantId,
        brandId: input.brandId,
        workdriveFileId: uploaded.fileId,
      },
    },
    create: {
      id: newId(),
      tenantId: input.tenantId,
      brandId: input.brandId,
      kind: 'posts',
      workdriveFileId: uploaded.fileId,
      folderId: uploaded.folderId,
      storageProvider: uploaded.storageProvider,
      storagePath: uploaded.storagePath,
      name: uploaded.name,
      mime: input.mime,
      size: BigInt(input.bytes.length),
      sha256,
      source: 'upload',
      createdBy: 'system',
    },
    update: { status: 'READY', missingSince: null, mime: input.mime },
  });
  await enqueueStorageBackupIfNeeded(row);
  const url = (await target.client.downloadUrl(uploaded.fileId)).url;
  return { url, mime: input.mime, sizeBytes: input.bytes.length };
}
