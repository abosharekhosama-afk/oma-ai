import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { catalogCoverage, DomainError } from '@oma/domain';

function parseAttributes(raw: string | null): Array<{ label: string; value: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (a): a is { label: string; value: string } =>
          Boolean(a) && typeof a.label === 'string' && typeof a.value === 'string',
      )
      .slice(0, 30);
  } catch {
    return [];
  }
}
import { catalogMediaByProductIds } from '../catalog/catalog.service';

@Injectable()
export class DiscoveryService {
  async listPages(
    tenantId: string,
    brandId: string,
    scanId: string,
    query: { cursor?: string; limit?: number; classification?: string; fetch_status?: string },
  ) {
    await this.assertScan(tenantId, brandId, scanId);
    const limit = Math.min(query.limit ?? 25, 100);
    const rows = await getPrisma().discoveredPage.findMany({
      where: tenantWhere(tenantId, {
        scanAttemptId: scanId,
        ...(query.classification ? { classification: query.classification as never } : {}),
        ...(query.fetch_status ? { fetchStatus: query.fetch_status as never } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      }),
      orderBy: { discoveredAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: data.map((p) => ({
        id: p.id,
        url: p.url,
        canonical_url: p.canonicalUrl,
        title: p.title,
        classification: p.classification,
        fetch_status: p.fetchStatus,
        http_status: p.httpStatus,
        locale_hint: p.localeHint,
      })),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  async listProducts(
    tenantId: string,
    brandId: string,
    scanId: string,
    query: { cursor?: string; limit?: number; kind?: string },
  ) {
    await this.assertScan(tenantId, brandId, scanId);
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
    const where = tenantWhere(tenantId, {
      scanAttemptId: scanId,
      ...(query.kind ? { kind: query.kind as never } : {}),
    });
    if (query.cursor) {
      const anchor = await getPrisma().discoveredProductService.findFirst({
        where: { ...where, id: query.cursor },
        select: { id: true },
      });
      if (!anchor) return { data: [], page: { next_cursor: null, limit } };
    }
    // Keyset pagination over (name, id) — stable even when names repeat.
    const rows = await getPrisma().discoveredProductService.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const mediaByProduct = await catalogMediaByProductIds(
      tenantId,
      data.map((p) => p.id),
    );
    return {
      data: data.map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        description: p.description,
        category: p.category,
        sku_public: p.skuPublic,
        price_amount: p.priceAmount,
        price_currency: p.priceCurrency,
        compare_at_price: p.compareAtPrice,
        availability: p.availability,
        source_page_id: p.sourcePageId,
        source_url: p.sourceUrl,
        parent_product_id: p.parentProductId,
        variant_count: p.variantCount,
        attributes: parseAttributes(p.attributesJson),
        extraction_source: p.extractionSource,
        confidence: p.confidence,
        media: mediaByProduct.get(p.id) ?? [],
      })),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
      summary: query.cursor ? undefined : await this.catalogSummary(tenantId, scanId),
    };
  }

  /** Whole-scan coverage so the UI can show what is missing without loading every page. */
  private async catalogSummary(tenantId: string, scanId: string) {
    const prisma = getPrisma();
    const rows = await prisma.discoveredProductService.findMany({
      where: tenantWhere(tenantId, { scanAttemptId: scanId }),
      select: {
        id: true,
        kind: true,
        description: true,
        priceAmount: true,
        category: true,
        availability: true,
      },
    });
    const mediaCounts = await prisma.catalogProductMedia.groupBy({
      by: ['discoveredProductId'],
      where: {
        tenantId,
        discoveredProductId: { in: rows.map((r) => r.id) },
        role: { in: ['SCAN_THUMBNAIL', 'SCAN_IMAGE', 'SCAN_VIDEO'] },
      },
      _count: { _all: true },
    });
    const countBy = new Map(mediaCounts.map((m) => [m.discoveredProductId, m._count._all]));
    const coverage = catalogCoverage(
      rows.map((r) => ({ ...r, mediaCount: countBy.get(r.id) ?? 0 })),
    );
    return {
      total: coverage.total,
      products: coverage.products,
      services: coverage.services,
      with_media: coverage.withMedia,
      with_description: coverage.withDescription,
      with_price: coverage.withPrice,
      with_category: coverage.withCategory,
      with_availability: coverage.withAvailability,
      scan_media_total: coverage.mediaTotal,
    };
  }

  async listEvidence(
    tenantId: string,
    brandId: string,
    scanId: string,
    query: { cursor?: string; limit?: number },
  ) {
    await this.assertScan(tenantId, brandId, scanId);
    const limit = Math.min(query.limit ?? 25, 100);
    const rows = await getPrisma().evidenceExcerpt.findMany({
      where: tenantWhere(tenantId, {
        scanAttemptId: scanId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      }),
      orderBy: { fetchedAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: data.map((e) => ({
        id: e.id,
        source_url: e.sourceUrl,
        canonical_url: e.canonicalUrl,
        page_title: e.pageTitle,
        fetched_at: e.fetchedAt.toISOString(),
        excerpt_text: e.excerptText,
        content_hash: e.contentHash,
        extraction_method: e.extractionMethod,
        scan_attempt_id: e.scanAttemptId,
        discovered_page_id: e.discoveredPageId,
      })),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  private async assertScan(tenantId: string, brandId: string, scanId: string) {
    const scan = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { id: scanId, brandId }),
    });
    if (!scan) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    return scan;
  }
}
