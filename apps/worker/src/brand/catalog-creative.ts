import { createHash } from 'node:crypto';
import {
  enqueueStorageBackupIfNeeded,
  getPrisma,
  resolveStorageWriteTarget,
  storageTargetForAsset,
  tenantWhere,
  uploadToStorageTarget,
  type StorageTarget,
} from '@oma/db';
import {
  DomainError,
  kenBurnsMp4FromImage,
  newId,
  safeFileName,
  type CatalogGenerateKind,
} from '@oma/domain';

async function loadSharp() {
  const mod = await import('sharp');
  return mod.default;
}

async function ffmpegBinary(): Promise<string | null> {
  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) return fromEnv;
  try {
    const mod = await import('ffmpeg-static');
    const p = (mod as { default?: string }).default;
    return p ?? null;
  } catch {
    return null;
  }
}

async function assertApprovedProfile(tenantId: string, brandId: string) {
  const brand = await getPrisma().brandWorkspace.findFirst({
    where: tenantWhere(tenantId, { id: brandId }),
  });
  if (!brand) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
  if (!brand.currentApprovedProfileVersionId) {
    throw new DomainError(
      'APPROVAL_INELIGIBLE',
      'Approve a brand profile before generating catalog media.',
      409,
      'errors.catalog_profile_required',
      [{ code: 'PROFILE_NOT_APPROVED' }],
    );
  }
  return brand;
}

async function loadSourceImage(tenantId: string, productId: string, brandId: string) {
  const product = await getPrisma().discoveredProductService.findFirst({
    where: tenantWhere(tenantId, { id: productId, brandId }),
  });
  if (!product) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
  const sourceLink = await getPrisma().catalogProductMedia.findFirst({
    where: {
      tenantId,
      discoveredProductId: product.id,
      role: { in: ['SCAN_THUMBNAIL', 'SCAN_IMAGE', 'GENERATED_IMAGE'] },
      reviewStatus: { in: ['APPROVED', 'PENDING'] },
      mediaAsset: { mime: { startsWith: 'image/' } },
    },
    include: { mediaAsset: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (!sourceLink?.mediaAsset) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'No product image to generate from.',
      400,
      'errors.catalog_no_source_image',
    );
  }
  return { product, sourceLink };
}

export async function runCatalogCreativeJob(input: {
  tenantId: string;
  brandId: string;
  discoveredProductId: string;
  kind: CatalogGenerateKind;
  actorUserId: string;
}) {
  const brand = await assertApprovedProfile(input.tenantId, input.brandId);
  const { product, sourceLink } = await loadSourceImage(
    input.tenantId,
    input.discoveredProductId,
    input.brandId,
  );
  // Read the source from wherever it lives; write AI output where the workspace setting says
  // (OMA storage by default — never the user's WorkDrive key unless the setting selects it).
  const reader = await storageTargetForAsset(input.tenantId, sourceLink.mediaAsset);
  const target = await resolveStorageWriteTarget(input.tenantId);

  const signed = await reader.client.downloadUrl(sourceLink.mediaAsset.workdriveFileId);
  const res = await fetch(signed.url);
  if (!res.ok) {
    throw new DomainError(
      'WORKDRIVE_ERROR',
      'Failed to read source image',
      502,
      'errors.media_fetch',
    );
  }
  const sourceBytes = Buffer.from(await res.arrayBuffer());

  const created: string[] = [];

  if (input.kind === 'image') {
    const sharp = await loadSharp();
    const variants = [
      { label: 'square', width: 1080, height: 1080, role: 'GENERATED_IMAGE' as const },
      { label: 'story', width: 1080, height: 1920, role: 'GENERATED_IMAGE' as const },
    ];
    for (const v of variants) {
      const out = await sharp(sourceBytes)
        .rotate()
        .resize(v.width, v.height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 88 })
        .toBuffer();
      const linkId = await uploadCatalogOutput({
        tenantId: input.tenantId,
        brandId: input.brandId,
        productId: product.id,
        productName: product.name,
        brand,
        target,
        bytes: out,
        mime: 'image/jpeg',
        role: v.role,
        actorUserId: input.actorUserId,
        label: v.label,
      });
      created.push(linkId);
    }
    return { generated: created.length, media_link_ids: created };
  }

  const ffmpeg = await ffmpegBinary();
  if (!ffmpeg) {
    throw new DomainError(
      'AI_NOT_CONFIGURED',
      'Video rendering is not available (ffmpeg missing).',
      503,
      'errors.catalog_video_not_configured',
      [{ code: 'FFMPEG_NOT_AVAILABLE', manual_journey: true }],
    );
  }

  const duration = input.kind === 'short_video' ? 8 : 18;
  const dimensions =
    input.kind === 'short_video'
      ? { width: 1080, height: 1350, role: 'GENERATED_SHORT_VIDEO' as const }
      : { width: 1080, height: 1920, role: 'GENERATED_VIDEO' as const };

  const jpegSource = await (
    await loadSharp()
  )(sourceBytes)
    .rotate()
    .jpeg({ quality: 90 })
    .toBuffer();
  const mp4 = await kenBurnsMp4FromImage({
    imageBytes: jpegSource,
    durationSeconds: duration,
    width: dimensions.width,
    height: dimensions.height,
    ffmpegPath: ffmpeg,
  });

  const linkId = await uploadCatalogOutput({
    tenantId: input.tenantId,
    brandId: input.brandId,
    productId: product.id,
    productName: product.name,
    brand,
    target,
    bytes: mp4,
    mime: 'video/mp4',
    role: dimensions.role,
    actorUserId: input.actorUserId,
    label: input.kind,
  });
  created.push(linkId);

  return { generated: created.length, media_link_ids: created };
}

async function uploadCatalogOutput(input: {
  tenantId: string;
  brandId: string;
  productId: string;
  productName: string;
  brand: { id: string; name: string };
  target: StorageTarget;
  bytes: Buffer;
  mime: string;
  role: 'GENERATED_IMAGE' | 'GENERATED_VIDEO' | 'GENERATED_SHORT_VIDEO';
  actorUserId: string;
  label: string;
}) {
  const sha256 = createHash('sha256').update(input.bytes).digest('hex');
  const ext = input.mime.includes('video') ? 'mp4' : 'jpg';
  const name = safeFileName(`${input.productName}-${input.label}-${sha256.slice(0, 8)}.${ext}`);
  const uploaded = await uploadToStorageTarget({
    target: input.target,
    brand: input.brand,
    kind: 'catalog',
    name,
    mime: input.mime,
    bytes: input.bytes,
    sha256,
  });
  const asset = await getPrisma().mediaAsset.create({
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
      mime: input.mime,
      size: BigInt(input.bytes.length),
      sha256,
      source: 'upload',
      lastCheckedAt: new Date(),
      createdBy: input.actorUserId,
    },
  });
  await enqueueStorageBackupIfNeeded(asset);
  const link = await getPrisma().catalogProductMedia.create({
    data: {
      id: newId(),
      tenantId: input.tenantId,
      brandId: input.brandId,
      discoveredProductId: input.productId,
      mediaAssetId: asset.id,
      role: input.role,
      reviewStatus: 'PENDING',
      sortOrder: 100,
    },
  });
  return link.id;
}
