import { createHash } from 'node:crypto';
import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  brandFolderSlug,
  clientFromConnection,
  mediaFolderSegments,
  newId,
  safeFileName,
  workDriveSecretKey,
} from '@oma/domain';

import type { CatalogGenerateKind } from '@oma/domain';

export type { CatalogGenerateKind };

async function loadSharp() {
  try {
    const mod = await import('sharp');
    return mod.default;
  } catch (e) {
    throw new DomainError(
      'STORAGE_OMA_UNAVAILABLE',
      `Image tooling unavailable: ${(e as Error).message}`,
      503,
      'errors.media_transcode_unavailable',
    );
  }
}

async function clientForTenant(tenantId: string) {
  const key = workDriveSecretKey();
  if (!key) return null;
  const conn = await getPrisma().workDriveConnection.findUnique({ where: { tenantId } });
  if (!conn || conn.status !== 'CONNECTED') return null;
  return { conn, client: clientFromConnection(conn, key) };
}

export async function generateCatalogProductCreative(input: {
  tenantId: string;
  brandId: string;
  discoveredProductId: string;
  kind: CatalogGenerateKind;
  actorUserId: string;
}) {
  if (input.kind === 'video' || input.kind === 'short_video') {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Use async catalog queue for video generation.',
      400,
      'errors.catalog_use_async_video',
    );
  }

  const brand = await getPrisma().brandWorkspace.findFirst({
    where: tenantWhere(input.tenantId, { id: input.brandId }),
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

  const product = await getPrisma().discoveredProductService.findFirst({
    where: tenantWhere(input.tenantId, {
      id: input.discoveredProductId,
      brandId: input.brandId,
    }),
  });
  if (!product) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');

  const sourceLink = await getPrisma().catalogProductMedia.findFirst({
    where: {
      tenantId: input.tenantId,
      discoveredProductId: product.id,
      role: { in: ['SCAN_THUMBNAIL', 'SCAN_IMAGE'] },
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

  const c = await clientForTenant(input.tenantId);
  if (!c) {
    throw new DomainError(
      'WORKDRIVE_NOT_CONNECTED',
      'WorkDrive is not connected.',
      503,
      'errors.workdrive_not_configured',
    );
  }

  const signed = await c.client.downloadUrl(sourceLink.mediaAsset.workdriveFileId);
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
  const sharp = await loadSharp();

  const variants: Array<{
    label: string;
    width: number;
    height: number;
    role: 'GENERATED_IMAGE' | 'GENERATED_VIDEO' | 'GENERATED_SHORT_VIDEO';
  }> =
    input.kind === 'image'
      ? [
          { label: 'square', width: 1080, height: 1080, role: 'GENERATED_IMAGE' },
          { label: 'story', width: 1080, height: 1920, role: 'GENERATED_IMAGE' },
        ]
      : [];

  const brandSlug = brandFolderSlug(brand.name, brand.id.slice(-8).toLowerCase());
  const { folderId } = await c.client.ensurePath(
    mediaFolderSegments({
      brandSlug,
      kind: 'catalog',
      rootFolderName: c.conn.rootFolderName,
    }),
  );

  const created: string[] = [];
  for (const v of variants) {
    const out = await sharp(sourceBytes)
      .rotate()
      .resize(v.width, v.height, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toBuffer();
    const sha256 = createHash('sha256').update(out).digest('hex');
    const name = safeFileName(`${product.name}-${v.label}-${sha256.slice(0, 8)}.jpg`);
    const uploaded = await c.client.upload({
      folderId,
      name,
      mimeType: 'image/jpeg',
      sha256,
      source: {
        size: out.length,
        full: () => out,
        part: async (s, e) => out.subarray(s, e),
      },
    });
    const asset = await getPrisma().mediaAsset.create({
      data: {
        id: newId(),
        tenantId: input.tenantId,
        brandId: input.brandId,
        kind: 'catalog',
        workdriveFileId: uploaded.fileId,
        folderId,
        storageProvider: 'USER_WORKDRIVE',
        name: uploaded.name,
        mime: 'image/jpeg',
        size: BigInt(out.length),
        sha256,
        source: 'upload',
        lastCheckedAt: new Date(),
        createdBy: input.actorUserId,
      },
    });
    const link = await getPrisma().catalogProductMedia.create({
      data: {
        id: newId(),
        tenantId: input.tenantId,
        brandId: input.brandId,
        discoveredProductId: product.id,
        mediaAssetId: asset.id,
        role: v.role,
        reviewStatus: 'PENDING',
        sortOrder: 100,
      },
    });
    created.push(link.id);
  }

  return { generated: created.length, media_link_ids: created };
}
