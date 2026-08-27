import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError } from '@oma/domain';

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
    const limit = Math.min(query.limit ?? 25, 100);
    const rows = await getPrisma().discoveredProductService.findMany({
      where: tenantWhere(tenantId, {
        scanAttemptId: scanId,
        ...(query.kind ? { kind: query.kind as never } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      }),
      orderBy: { name: 'asc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
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
        availability: p.availability,
        source_page_id: p.sourcePageId,
        parent_product_id: p.parentProductId,
      })),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
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
