import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, type CatalogGenerateKind, type CatalogOffering } from '@oma/domain';
import { mediaViewUrl } from '../media/media.service';
import { generateCatalogProductCreative } from './catalog-generate';
import { enqueueCatalogGenerate, enqueueCatalogReimport } from './enqueue-catalog';

function mapCatalogMedia(row: {
  id: string;
  role: string;
  reviewStatus: string;
  sourceUrl: string | null;
  sortOrder: number;
  mediaAsset: { id: string; mime: string; name: string; status: string };
}) {
  return {
    id: row.id,
    role: row.role,
    review_status: row.reviewStatus,
    source_url: row.sourceUrl,
    sort_order: row.sortOrder,
    mime: row.mediaAsset.mime,
    name: row.mediaAsset.name,
    status: row.mediaAsset.status,
    view_url: mediaViewUrl(row.mediaAsset.id),
    stream_url: row.mediaAsset.mime.startsWith('video/')
      ? `/api/v1/media/${row.mediaAsset.id}/stream`
      : null,
  };
}

@Injectable()
export class CatalogService {
  async generate(
    tenantId: string,
    brandId: string,
    productId: string,
    kind: CatalogGenerateKind,
    actorUserId: string,
  ) {
    if (kind === 'video' || kind === 'short_video') {
      const jobId = await enqueueCatalogGenerate({
        tenantId,
        brandId,
        discoveredProductId: productId,
        kind,
        actorUserId,
      });
      if (!jobId) {
        throw new DomainError(
          'PROVIDER_NOT_CONFIGURED',
          'Background queue is not available.',
          503,
          'errors.queue_unavailable',
        );
      }
      return { data: { queued: true as const, job_id: jobId, generated: 0 } };
    }
    const data = await generateCatalogProductCreative({
      tenantId,
      brandId,
      discoveredProductId: productId,
      kind,
      actorUserId,
    });
    return { data: { queued: false as const, ...data } };
  }

  async reviewMediaLink(
    tenantId: string,
    brandId: string,
    linkId: string,
    decision: 'approve' | 'reject',
    actorUserId: string,
  ) {
    const row = await getPrisma().catalogProductMedia.findFirst({
      where: tenantWhere(tenantId, { id: linkId, brandId }),
      include: { mediaAsset: true },
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (!row.role.startsWith('GENERATED_')) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Only generated catalog media can be reviewed here.',
        400,
        'errors.validation_failed',
      );
    }
    if (row.reviewStatus !== 'PENDING') {
      throw new DomainError(
        'CONFLICT_STATE',
        'This media item was already reviewed.',
        409,
        'errors.validation_failed',
      );
    }
    const next = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    await getPrisma().catalogProductMedia.update({
      where: { id: row.id },
      data: { reviewStatus: next },
    });
    return { data: { id: row.id, review_status: next, reviewed_by: actorUserId } };
  }

  async reimportScanMedia(tenantId: string, brandId: string, scanAttemptId: string) {
    const scan = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { id: scanAttemptId, brandId }),
    });
    if (!scan) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (scan.status !== 'SUCCEEDED' && scan.status !== 'PARTIAL') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Scan must finish before re-importing media.',
        409,
        'errors.validation_failed',
      );
    }
    const jobId = await enqueueCatalogReimport({ tenantId, brandId, scanAttemptId });
    if (!jobId) {
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'Background queue is not available.',
        503,
        'errors.queue_unavailable',
      );
    }
    return { data: { queued: true, job_id: jobId } };
  }

  async listProductMedia(tenantId: string, brandId: string, productId: string) {
    await this.assertProduct(tenantId, brandId, productId);
    const rows = await getPrisma().catalogProductMedia.findMany({
      where: tenantWhere(tenantId, { brandId, discoveredProductId: productId }),
      include: { mediaAsset: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return { data: rows.map(mapCatalogMedia) };
  }

  private async assertProduct(tenantId: string, brandId: string, productId: string) {
    const row = await getPrisma().discoveredProductService.findFirst({
      where: tenantWhere(tenantId, { id: productId, brandId }),
    });
    if (!row) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return row;
  }
}

export async function catalogMediaByProductIds(tenantId: string, productIds: string[]) {
  if (!productIds.length) return new Map<string, ReturnType<typeof mapCatalogMedia>[]>();
  const rows = await getPrisma().catalogProductMedia.findMany({
    where: { tenantId, discoveredProductId: { in: productIds } },
    include: { mediaAsset: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const out = new Map<string, ReturnType<typeof mapCatalogMedia>[]>();
  for (const row of rows) {
    const list = out.get(row.discoveredProductId) ?? [];
    list.push(mapCatalogMedia(row));
    out.set(row.discoveredProductId, list);
  }
  return out;
}

export async function enrichCatalogOfferingsWithApprovedMedia(
  tenantId: string,
  offerings: CatalogOffering[],
): Promise<CatalogOffering[]> {
  const productIds = offerings.map((o) => o.product_id).filter(Boolean) as string[];
  if (!productIds.length) return offerings;
  const mediaByProduct = await catalogMediaByProductIds(tenantId, productIds);
  return offerings.map((offering) => {
    if (!offering.product_id) return offering;
    const media = mediaByProduct.get(offering.product_id) ?? [];
    const usable = media.filter(
      (m) => m.review_status === 'APPROVED' || m.role.startsWith('SCAN_'),
    );
    const primary =
      usable.find((m) => m.role === 'SCAN_THUMBNAIL') ??
      usable.find((m) => m.mime.startsWith('image/')) ??
      usable.find((m) => m.mime.startsWith('video/'));
    if (!primary) return offering;
    return { ...offering, primary_media_view_url: primary.view_url };
  });
}
