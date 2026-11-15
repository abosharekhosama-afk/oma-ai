import { getPrisma, tenantWhere } from '@oma/db';
import {
  extractFromHtml,
  isInCrawlScope,
  maxProductMediaFromEnv,
  productMediaUrlCount,
  productNameKey,
  productUrlKey,
  resolveJsRenderMode,
  shouldAdoptRenderedExtraction,
  shouldUseJsRender,
  ProductCatalogAccumulator,
  productDedupeKey,
  newId,
  type ExtractedProduct,
  type WebsiteConnectorPort,
} from '@oma/domain';
import { fetchRenderedPageHtml } from './rendered-page-fetch';
import { syncProductScanMedia } from './catalog-product-media';
import { fetchPlatformCatalog } from './platform-catalog';

export type CatalogReimportResult = {
  products: number;
  updated: number;
  created: number;
  /** Rows removed because their page is not a product page (category, home section, label). */
  removed: number;
  /** Not-a-product rows kept because they carry generated/reviewed media. */
  retained: number;
  imported: number;
  mediaRemoved: number;
  skipped: number;
  platform: string | null;
};

type ProductRow = Awaited<
  ReturnType<ReturnType<typeof getPrisma>['discoveredProductService']['findMany']>
>[number];

async function extractPage(
  connector: WebsiteConnectorPort,
  url: string,
): Promise<ExtractedProduct[] | null> {
  const fetched = await connector.fetchPublic({ url, accept: 'html' });
  if (fetched.status < 200 || fetched.status >= 400 || !fetched.body) return null;
  let extracted = extractFromHtml(fetched.finalUrl, fetched.body);
  const jsRenderMode = resolveJsRenderMode(process.env.BRAND_SCANNER_JS_RENDER_MODE);
  if (
    shouldUseJsRender({
      mode: jsRenderMode,
      html: fetched.body,
      pageUrl: url,
      productCount: extracted.products.length,
      productMediaCount: productMediaUrlCount(extracted.products),
    })
  ) {
    try {
      const renderedHtml = await fetchRenderedPageHtml(fetched.finalUrl);
      const rendered = extractFromHtml(fetched.finalUrl, renderedHtml);
      if (
        shouldAdoptRenderedExtraction(
          jsRenderMode,
          extracted.products.length,
          extracted.fields.filter((f) => !f.isUnknown).length,
          productMediaUrlCount(extracted.products),
          rendered.products.length,
          rendered.fields.filter((f) => !f.isUnknown).length,
          productMediaUrlCount(rendered.products),
        )
      ) {
        extracted = rendered;
      }
    } catch {
      /* keep static extraction */
    }
  }
  return extracted.products;
}

function rowData(product: ExtractedProduct) {
  return {
    name: product.name,
    description: product.description ?? null,
    category: product.category ?? null,
    skuPublic: product.skuPublic ?? null,
    priceAmount: product.priceAmount ?? null,
    priceCurrency: product.priceCurrency ?? null,
    compareAtPrice: product.compareAtPrice ?? null,
    availability: product.availability ?? null,
    sourceUrl: product.sourceUrl ?? null,
    platformId: product.platformId ?? null,
    variantCount: product.variantCount ?? null,
    attributesJson: product.attributes?.length ? JSON.stringify(product.attributes) : null,
    extractionSource: product.extractionSource ?? null,
    confidence: product.confidence ?? null,
  };
}

/**
 * Re-reads every product of a scan from the live site and reconciles it in place:
 *  - real products get fresh fields and exactly their own media (stale scan media unlinked);
 *  - rows that are not products (categories, home sections, badges) are removed unless they
 *    already carry generated/human-reviewed media, in which case only their scan media goes;
 *  - products the platform catalog lists but the scan missed are added.
 * Idempotent: running it twice leaves the same rows and links.
 */
export async function reimportCatalogMediaForScan(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  connector: WebsiteConnectorPort;
}): Promise<CatalogReimportResult> {
  const prisma = getPrisma();
  const result: CatalogReimportResult = {
    products: 0,
    updated: 0,
    created: 0,
    removed: 0,
    retained: 0,
    imported: 0,
    mediaRemoved: 0,
    skipped: 0,
    platform: null,
  };
  const scan = await prisma.scanAttempt.findFirst({
    where: tenantWhere(input.tenantId, { id: input.scanAttemptId, brandId: input.brandId }),
    include: { websiteSource: true, brand: { select: { name: true } } },
  });
  const startUrl = scan?.websiteSource?.normalizedUrl;
  if (!scan || !startUrl) return result;
  const brandName = scan.brand.name;
  const mediaCap = maxProductMediaFromEnv();
  const maxProducts = Math.max(1, Number(process.env.BRAND_MAX_PRODUCTS ?? 1000) || 1000);
  const deadline = Date.now() + Number(process.env.BRAND_REIMPORT_MAX_SECONDS ?? 900) * 1000;

  const rows = await prisma.discoveredProductService.findMany({
    where: { tenantId: input.tenantId, scanAttemptId: input.scanAttemptId, brandId: input.brandId },
    include: { catalogMedia: { select: { id: true, role: true } } },
  });
  result.products = rows.length;

  // 1) Authoritative catalog from the platform API when the store has one.
  const catalog = new ProductCatalogAccumulator(maxProducts);
  let platformComplete = false;
  try {
    const home = await input.connector.fetchPublic({ url: startUrl, accept: 'html' });
    if (home.status < 400) {
      const platform = await fetchPlatformCatalog({
        startUrl: home.finalUrl,
        homeHtml: home.body,
        connector: input.connector,
        deadline,
        maxProducts,
        mediaCap,
      });
      result.platform = platform.detection?.platform ?? null;
      for (const product of platform.products) catalog.add(product);
      platformComplete =
        platform.error === null &&
        platform.products.length > 0 &&
        platform.products.length < maxProducts;
    }
  } catch {
    /* page-by-page fallback below */
  }

  // 2) Re-extract each row's own page (cached per URL).
  const pages = await prisma.discoveredPage.findMany({
    where: {
      tenantId: input.tenantId,
      scanAttemptId: input.scanAttemptId,
      id: { in: rows.map((r) => r.sourcePageId).filter((id): id is string => Boolean(id)) },
    },
    select: { id: true, url: true },
  });
  const pageUrlById = new Map(pages.map((p) => [p.id, p.url]));
  const pageCache = new Map<string, ExtractedProduct[] | null>();

  const findInCatalog = (row: ProductRow): ExtractedProduct | null => {
    const probe: ExtractedProduct = {
      kind: row.kind,
      name: row.name,
      skuPublic: row.skuPublic ?? undefined,
      sourceUrl: row.sourceUrl ?? undefined,
      platformId: row.platformId ?? undefined,
    };
    if (!catalog.has(probe)) return null;
    const key = productDedupeKey(probe);
    return (
      catalog
        .list()
        .map((e) => e.product)
        .find(
          (p) =>
            productDedupeKey(p) === key ||
            (row.platformId && p.platformId === row.platformId) ||
            (row.sourceUrl && productUrlKey(p.sourceUrl) === productUrlKey(row.sourceUrl)) ||
            productNameKey(p.name) === productNameKey(row.name),
        ) ?? null
    );
  };

  const claimed = new Set<string>();
  for (const row of rows) {
    if (Date.now() > deadline) {
      result.skipped++;
      continue;
    }
    let match = findInCatalog(row);
    const pageUrl = row.sourceUrl ?? (row.sourcePageId ? pageUrlById.get(row.sourcePageId) : null);
    let pageChecked = false;
    if (!match && pageUrl && isInCrawlScope(startUrl, pageUrl)) {
      if (!pageCache.has(pageUrl)) {
        try {
          pageCache.set(pageUrl, await extractPage(input.connector, pageUrl));
        } catch {
          pageCache.set(pageUrl, null);
        }
      }
      const found = pageCache.get(pageUrl);
      if (found) {
        pageChecked = true;
        // Products really described by this page are added below if the scan lacks them.
        for (const product of found) catalog.add(product, pageUrl);
        match =
          found.find(
            (p) => p.kind === row.kind && productNameKey(p.name) === productNameKey(row.name),
          ) ??
          // The row was created from a page that is really one product's page under a
          // wrong name (e.g. a category heading) — never re-use it for another product.
          null;
      }
    }

    const matchKey = match ? productDedupeKey(match) : null;
    const duplicate = Boolean(matchKey && claimed.has(matchKey));
    if (!match || duplicate) {
      // Only prune when we positively re-read the page (or the platform catalog) and the row
      // is not there; network failures never delete data. A second row for an already
      // claimed product is a duplicate from the old heuristics and is pruned the same way.
      const verified = duplicate || pageChecked || platformComplete;
      if (!verified) {
        result.skipped++;
        continue;
      }
      const hasHumanMedia = row.catalogMedia.some((m) => !m.role.startsWith('SCAN_'));
      if (hasHumanMedia) {
        const removed = await prisma.catalogProductMedia.deleteMany({
          where: {
            discoveredProductId: row.id,
            role: { in: ['SCAN_THUMBNAIL', 'SCAN_IMAGE', 'SCAN_VIDEO'] },
          },
        });
        result.mediaRemoved += removed.count;
        result.retained++;
      } else {
        await prisma.discoveredProductService.delete({ where: { id: row.id } });
        result.removed++;
      }
      continue;
    }

    claimed.add(matchKey!);
    // Move legacy rows onto the current identity key when it is free in this scan.
    const keyTaken =
      row.dedupeKey !== matchKey &&
      (await prisma.discoveredProductService.count({
        where: { scanAttemptId: input.scanAttemptId, dedupeKey: matchKey! },
      })) > 0;
    await prisma.discoveredProductService.update({
      where: { id: row.id },
      data: { ...rowData(match!), ...(keyTaken ? {} : { dedupeKey: matchKey! }) },
    });
    result.updated++;
    const synced = await syncProductScanMedia({
      tenantId: input.tenantId,
      brandId: input.brandId,
      brandName,
      discoveredProductId: row.id,
      productName: match!.name,
      media: match!.media ?? [],
    });
    result.imported += synced.imported;
    result.mediaRemoved += synced.removed;
    result.skipped += synced.skipped;
  }

  // 3) Products the platform lists that the original scan never found.
  const existingKeys = new Set(
    (
      await prisma.discoveredProductService.findMany({
        where: { tenantId: input.tenantId, scanAttemptId: input.scanAttemptId },
        select: { dedupeKey: true },
      })
    ).map((r) => r.dedupeKey),
  );
  for (const { product } of catalog.list()) {
    if (Date.now() > deadline) break;
    const dedupeKey = productDedupeKey(product);
    if (claimed.has(dedupeKey) || existingKeys.has(dedupeKey)) continue;
    const row = await prisma.discoveredProductService.create({
      data: {
        id: newId(),
        tenantId: input.tenantId,
        brandId: input.brandId,
        scanAttemptId: input.scanAttemptId,
        kind: product.kind,
        dedupeKey,
        ...rowData(product),
      },
    });
    existingKeys.add(dedupeKey);
    result.created++;
    if (product.media?.length) {
      const synced = await syncProductScanMedia({
        tenantId: input.tenantId,
        brandId: input.brandId,
        brandName,
        discoveredProductId: row.id,
        productName: product.name,
        media: product.media,
      });
      result.imported += synced.imported;
      result.skipped += synced.skipped;
    }
  }

  return result;
}
