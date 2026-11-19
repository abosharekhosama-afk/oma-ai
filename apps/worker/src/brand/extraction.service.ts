import { getPrisma } from '@oma/db';
import {
  buildCatalogFieldValue,
  classifyJsRenderError,
  buildMarketingSeedUrls,
  buildSitemapSeedUrls,
  canonicalHash,
  canonicalizeUrl,
  contentHash,
  discoveryTierForField,
  extractFromHtml,
  inferCrawlStopReason,
  isBrandFixtureConnectorEnabled,
  isCatalogLikePath,
  isInCrawlScope,
  isLowValueCrawlPath,
  isProductDetailUrl,
  isProductLikePathname,
  maxJsRenderPagesFromEnv,
  maxProductMediaFromEnv,
  newId,
  productDedupeKey,
  ProductCatalogAccumulator,
  productUrlKey,
  type ExtractedProduct,
  parseSitemapXml,
  resolveJsRenderMode,
  scanCatalogProgressPercent,
  scanCrawlProgressPercent,
  scanSitemapProgressPercent,
  SCAN_CANCELLED_MESSAGE,
  shouldAdoptRenderedExtraction,
  productMediaUrlCount,
  shouldUseJsRender,
  type WebsiteConnectorPort,
} from '@oma/domain';
import {
  fetchRenderedPageHtml,
  lastBrowserInitError,
  RenderedPageFetchError,
} from './rendered-page-fetch';
import { syncProductScanMedia } from './catalog-product-media';
import { fetchPlatformCatalog } from './platform-catalog';

type CrawlConfig = {
  max_pages?: number;
  max_depth?: number;
  max_duration_seconds?: number;
};

function pagePath(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname || '/'}${parsed.search}`;
}

function enqueueCrawlUrl(
  queue: { url: string; depth: number }[],
  url: string,
  depth: number,
  priority = false,
  productPagesFirst = true,
) {
  const entry = { url, depth };
  if (priority) {
    queue.unshift(entry);
    return;
  }
  try {
    // Single-product pages carry the product's own gallery and facts — crawl them first.
    const path = new URL(url).pathname;
    if (isLowValueCrawlPath(path)) {
      queue.push(entry);
      return;
    }
    if (
      productPagesFirst &&
      (isProductDetailUrl(url) || isProductLikePathname(path) || isCatalogLikePath(path))
    ) {
      queue.unshift(entry);
      return;
    }
    if (isCatalogLikePath(path) || isProductLikePathname(path)) {
      // After product pages, before everything else.
      const firstOther = queue.findIndex((q) => !isProductDetailUrl(q.url));
      if (firstOther < 0) queue.push(entry);
      else queue.splice(firstOther, 0, entry);
    } else queue.push(entry);
  } catch {
    queue.push(entry);
  }
}

export type CatalogScanStats = {
  platform: string | null;
  platformEvidence: string | null;
  platformProducts: number;
  platformError: string | null;
  productsPersisted: number;
  productsWithMedia: number;
  productMediaImported: number;
  productMediaSkipped: number;
};

/** Persists the merged catalog once per scan and attaches each product's own media. */
async function persistCatalog(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  catalog: ProductCatalogAccumulator;
  pageIdByKey: Map<string, string>;
}): Promise<
  Pick<
    CatalogScanStats,
    'productsPersisted' | 'productsWithMedia' | 'productMediaImported' | 'productMediaSkipped'
  >
> {
  const prisma = getPrisma();
  const brandRow = await prisma.brandWorkspace.findFirst({
    where: { id: input.brandId, tenantId: input.tenantId },
    select: { name: true },
  });
  let productsPersisted = 0;
  let productsWithMedia = 0;
  let productMediaImported = 0;
  let productMediaSkipped = 0;
  for (const entry of input.catalog.list()) {
    const product: ExtractedProduct = entry.product;
    const dedupeKey = productDedupeKey(product);
    const ownKey = productUrlKey(product.sourceUrl);
    const sourcePageId =
      (ownKey ? input.pageIdByKey.get(ownKey) : undefined) ??
      entry.pageUrls.map((u) => input.pageIdByKey.get(productUrlKey(u) ?? '')).find(Boolean) ??
      null;
    const data = {
      kind: product.kind,
      name: product.name,
      description: product.description ?? null,
      category: product.category ?? null,
      skuPublic: product.skuPublic ?? null,
      priceAmount: product.priceAmount ?? null,
      priceCurrency: product.priceCurrency ?? null,
      compareAtPrice: product.compareAtPrice ?? null,
      availability: product.availability ?? null,
      sourcePageId,
      sourceUrl: product.sourceUrl ?? null,
      platformId: product.platformId ?? null,
      variantCount: product.variantCount ?? null,
      attributesJson: product.attributes?.length ? JSON.stringify(product.attributes) : null,
      extractionSource: product.extractionSource ?? null,
      confidence: product.confidence ?? null,
    };
    const row = await prisma.discoveredProductService.upsert({
      where: { scanAttemptId_dedupeKey: { scanAttemptId: input.scanAttemptId, dedupeKey } },
      create: {
        id: newId(),
        tenantId: input.tenantId,
        brandId: input.brandId,
        scanAttemptId: input.scanAttemptId,
        dedupeKey,
        ...data,
      },
      update: data,
    });
    productsPersisted += 1;
    if (product.media?.length && brandRow) {
      const synced = await syncProductScanMedia({
        tenantId: input.tenantId,
        brandId: input.brandId,
        brandName: brandRow.name,
        discoveredProductId: row.id,
        productName: product.name,
        media: product.media,
      });
      productMediaImported += synced.imported;
      productMediaSkipped += synced.skipped;
      if (synced.imported + synced.kept > 0) productsWithMedia += 1;
    }
  }
  return { productsPersisted, productsWithMedia, productMediaImported, productMediaSkipped };
}

async function persistCatalogObservations(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
}) {
  const rows = await getPrisma().discoveredProductService.findMany({
    where: {
      tenantId: input.tenantId,
      scanAttemptId: input.scanAttemptId,
    },
    orderBy: { name: 'asc' },
  });
  const catalog = buildCatalogFieldValue(rows);
  if (!catalog.products && !catalog.services) return;
  const productWithPage = rows.find((row) => row.kind === 'PRODUCT');
  const anchorEvidence = productWithPage?.sourcePageId
    ? await getPrisma().evidenceExcerpt.findFirst({
        where: {
          tenantId: input.tenantId,
          scanAttemptId: input.scanAttemptId,
          discoveredPageId: productWithPage.sourcePageId,
        },
      })
    : null;
  const evidenceId =
    anchorEvidence?.id ??
    (
      await getPrisma().evidenceExcerpt.findFirst({
        where: { tenantId: input.tenantId, scanAttemptId: input.scanAttemptId },
        orderBy: { fetchedAt: 'asc' },
      })
    )?.id;
  for (const fieldKey of ['catalog.products', 'catalog.services'] as const) {
    const value = fieldKey === 'catalog.products' ? catalog.products : catalog.services;
    if (!value) continue;
    await getPrisma().extractedObservation.create({
      data: {
        id: newId(),
        tenantId: input.tenantId,
        brandId: input.brandId,
        scanAttemptId: input.scanAttemptId,
        fieldKey,
        discoveryTier: discoveryTierForField(fieldKey) as never,
        valueJson: JSON.stringify(value),
        isUnknown: false,
        infoState: 'OBSERVED',
        confidence: 0.75,
        evidenceId: evidenceId ?? null,
      },
    });
  }
}

export type ScanExtractionProgress = {
  progressPercent: number;
  status?: 'CRAWLING' | 'EXTRACTING';
  pagesFetched?: number;
  pagesFailed?: number;
  pagesSkipped?: number;
};

async function ensureScanNotAborted(shouldAbort?: () => Promise<boolean>) {
  if (shouldAbort && (await shouldAbort())) {
    throw new Error(SCAN_CANCELLED_MESSAGE);
  }
}

export async function runExtractionForScan(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  startUrl: string;
  connector: WebsiteConnectorPort;
  config?: CrawlConfig;
  onProgress?: (patch: ScanExtractionProgress) => Promise<void>;
  shouldAbort?: () => Promise<boolean>;
}) {
  const maxPages = input.config?.max_pages ?? Number(process.env.BRAND_MAX_PAGES ?? 50);
  const maxDepth = input.config?.max_depth ?? Number(process.env.BRAND_MAX_DEPTH ?? 3);
  const maxBytes = Number(process.env.BRAND_MAX_BYTES ?? 1_000_000);
  const maxSitemapDocuments = Number(process.env.BRAND_MAX_SITEMAP_DOCUMENTS ?? 5);
  const deadline = Date.now() + (input.config?.max_duration_seconds ?? 600) * 1000;

  const mediaCap = maxProductMediaFromEnv();
  const maxProducts = Math.max(1, Number(process.env.BRAND_MAX_PRODUCTS ?? 1000) || 1000);
  const catalog = new ProductCatalogAccumulator(maxProducts);
  const pageIdByKey = new Map<string, string>();
  let platformChecked = false;
  let productPagesFirst = true;
  const catalogStats: CatalogScanStats = {
    platform: null,
    platformEvidence: null,
    platformProducts: 0,
    platformError: null,
    productsPersisted: 0,
    productsWithMedia: 0,
    productMediaImported: 0,
    productMediaSkipped: 0,
  };

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [];
  enqueueCrawlUrl(queue, canonicalizeUrl(input.startUrl), 0, true);
  const fixtureCrawl = isBrandFixtureConnectorEnabled();
  if (!fixtureCrawl) {
    for (const seedUrl of buildMarketingSeedUrls(input.startUrl)) {
      if (isInCrawlScope(input.startUrl, seedUrl)) {
        enqueueCrawlUrl(queue, canonicalizeUrl(seedUrl), 1, true);
      }
    }
  }
  let pagesFetched = 0;
  let pagesFailed = 0;
  let pagesSkipped = 0;
  let pagesJsRendered = 0;
  let pagesJsRenderAttempted = 0;
  let pagesJsRenderFailed = 0;
  const jsRenderErrors: string[] = [];
  const jsRenderErrorDetails: string[] = [];
  let jsRenderLaunchDetail: string | null = null;
  const jsRenderMode = resolveJsRenderMode(process.env.BRAND_SCANNER_JS_RENDER_MODE);
  let jsRenderBudget = maxJsRenderPagesFromEnv();

  const recordJsRenderError = (code: string, detail?: string) => {
    if (code === 'PLAYWRIGHT_LAUNCH_FAILED') {
      const launchDetail = detail ?? lastBrowserInitError();
      if (launchDetail && !jsRenderLaunchDetail) {
        jsRenderLaunchDetail = launchDetail.slice(0, 500);
      }
    }
    if (!jsRenderErrors.includes(code) && jsRenderErrors.length < 8) {
      jsRenderErrors.push(code);
    }
    const line = detail ? `${code}: ${detail.slice(0, 180)}` : code;
    if (!jsRenderErrorDetails.includes(line) && jsRenderErrorDetails.length < 8) {
      jsRenderErrorDetails.push(line);
    }
  };

  const report = input.onProgress;
  const emitProgress = async (patch: ScanExtractionProgress) => {
    if (report) await report(patch);
  };

  const startHost = new URL(input.startUrl).host;
  await ensureScanNotAborted(input.shouldAbort);
  try {
    const robotsInfo = await input.connector.inspectRobots(startHost);
    const seedTargets = fixtureCrawl
      ? [...robotsInfo.sitemaps]
      : [...new Set([...robotsInfo.sitemaps, ...buildSitemapSeedUrls(input.startUrl)])];
    const sitemapDocs = [...new Set(seedTargets)].slice(0, maxSitemapDocuments);
    let docsFetched = 0;
    while (sitemapDocs.length > 0 && docsFetched < maxSitemapDocuments && Date.now() < deadline) {
      await ensureScanNotAborted(input.shouldAbort);
      const sitemapUrl = sitemapDocs.shift();
      if (!sitemapUrl) break;
      docsFetched += 1;
      await emitProgress({
        progressPercent: scanSitemapProgressPercent(),
        status: 'CRAWLING',
        pagesFetched,
        pagesFailed,
        pagesSkipped,
      });
      try {
        const fetched = await input.connector.fetchPublic({
          url: sitemapUrl,
          maxBytes: Math.min(maxBytes, 512_000),
          accept: 'xml',
        });
        if (fetched.status >= 400) continue;
        const parsed = parseSitemapXml(fetched.body, maxPages);
        for (const nested of parsed.sitemaps) {
          if (
            sitemapDocs.length + docsFetched < maxSitemapDocuments &&
            isInCrawlScope(input.startUrl, nested)
          ) {
            sitemapDocs.push(nested);
          }
        }
        for (const loc of parsed.urls) {
          if (isInCrawlScope(input.startUrl, loc)) {
            enqueueCrawlUrl(queue, canonicalizeUrl(loc), 1);
          }
        }
      } catch {
        // sitemap discovery is best-effort
      }
    }
  } catch {
    // robots/sitemap discovery is best-effort
  }

  await emitProgress({
    progressPercent: scanSitemapProgressPercent(),
    status: 'CRAWLING',
    pagesFetched,
    pagesFailed,
    pagesSkipped,
  });

  while (queue.length > 0 && pagesFetched < maxPages && Date.now() < deadline) {
    await ensureScanNotAborted(input.shouldAbort);
    const current = queue.shift();
    if (!current) break;
    let normalizedUrl = current.url;
    try {
      normalizedUrl = canonicalizeUrl(current.url);
    } catch {
      pagesFailed += 1;
      continue;
    }
    const hash = canonicalHash(normalizedUrl);
    if (visited.has(hash)) continue;
    visited.add(hash);

    const host = new URL(normalizedUrl).host;
    const robots = await input.connector.evaluateRobots(host, pagePath(normalizedUrl));
    if (robots === 'DISALLOW') {
      pagesSkipped += 1;
      await getPrisma().discoveredPage.create({
        data: {
          id: newId(),
          tenantId: input.tenantId,
          brandId: input.brandId,
          scanAttemptId: input.scanAttemptId,
          url: normalizedUrl,
          canonicalUrl: normalizedUrl,
          canonicalHash: hash,
          classification: 'OTHER',
          fetchStatus: 'SKIPPED_ROBOTS',
          failureReason: 'ROBOTS',
        },
      });
      continue;
    }

    try {
      const fetched = await input.connector.fetchPublic({
        url: normalizedUrl,
        maxBytes,
      });
      if (fetched.status >= 400) {
        pagesFailed += 1;
        await getPrisma().discoveredPage.create({
          data: {
            id: newId(),
            tenantId: input.tenantId,
            brandId: input.brandId,
            scanAttemptId: input.scanAttemptId,
            url: normalizedUrl,
            canonicalUrl: fetched.finalUrl,
            canonicalHash: canonicalHash(fetched.finalUrl),
            httpStatus: fetched.status,
            contentType: fetched.contentType,
            fetchStatus: 'FAILED',
            failureReason: `HTTP_${fetched.status}`,
          },
        });
        continue;
      }

      let htmlBody = fetched.body;
      if (!platformChecked && !fixtureCrawl) {
        platformChecked = true;
        const platform = await fetchPlatformCatalog({
          startUrl: fetched.finalUrl,
          homeHtml: htmlBody,
          connector: input.connector,
          deadline,
          maxProducts,
          mediaCap,
        });
        catalogStats.platform = platform.detection?.platform ?? null;
        catalogStats.platformEvidence = platform.detection?.evidence ?? null;
        catalogStats.platformError = platform.error;
        catalogStats.platformProducts = platform.products.length;
        for (const product of platform.products) catalog.add(product);
        // Optional boost only: empty platform API must not reduce page-crawl priority.
        if (platform.products.length > 0) productPagesFirst = false;
      }
      let extracted = extractFromHtml(fetched.finalUrl, htmlBody);
      let pageUsedRendered = false;
      const wantsJsRender =
        shouldUseJsRender({
          mode: jsRenderMode,
          html: htmlBody,
          pageUrl: normalizedUrl,
          productCount: extracted.products.length,
          productMediaCount: productMediaUrlCount(extracted.products),
          knownFieldCount: extracted.fields.filter((f) => !f.isUnknown).length,
        }) &&
        (jsRenderMode === 'always' || jsRenderBudget > 0);
      if (wantsJsRender) {
        await ensureScanNotAborted(input.shouldAbort);
        if (jsRenderMode !== 'always') jsRenderBudget -= 1;
        pagesJsRenderAttempted += 1;
        try {
          const renderedHtml = await fetchRenderedPageHtml(fetched.finalUrl);
          const renderedExtracted = extractFromHtml(fetched.finalUrl, renderedHtml);
          const staticKnown = extracted.fields.filter((f) => !f.isUnknown).length;
          const renderedKnown = renderedExtracted.fields.filter((f) => !f.isUnknown).length;
          if (
            shouldAdoptRenderedExtraction(
              jsRenderMode,
              extracted.products.length,
              staticKnown,
              productMediaUrlCount(extracted.products),
              renderedExtracted.products.length,
              renderedKnown,
              productMediaUrlCount(renderedExtracted.products),
            )
          ) {
            htmlBody = renderedHtml;
            extracted = renderedExtracted;
            pageUsedRendered = true;
            pagesJsRendered += 1;
          }
        } catch (err) {
          pagesJsRenderFailed += 1;
          const classified =
            err instanceof RenderedPageFetchError
              ? { code: err.code, message: err.message }
              : classifyJsRenderError(err);
          recordJsRenderError(classified.code, classified.message);
        }
      }
      const pageCanonical =
        extracted.canonicalUrl && isInCrawlScope(input.startUrl, extracted.canonicalUrl)
          ? canonicalizeUrl(extracted.canonicalUrl)
          : canonicalizeUrl(fetched.finalUrl);
      const pageId = newId();
      await getPrisma().discoveredPage.create({
        data: {
          id: pageId,
          tenantId: input.tenantId,
          brandId: input.brandId,
          scanAttemptId: input.scanAttemptId,
          url: normalizedUrl,
          canonicalUrl: pageCanonical,
          canonicalHash: canonicalHash(pageCanonical),
          title: extracted.pageTitle,
          httpStatus: fetched.status,
          contentType: fetched.contentType,
          classification: extracted.classification as never,
          fetchStatus: 'FETCHED',
        },
      });

      const evidenceId = newId();
      await getPrisma().evidenceExcerpt.create({
        data: {
          id: evidenceId,
          tenantId: input.tenantId,
          brandId: input.brandId,
          scanAttemptId: input.scanAttemptId,
          sourceUrl: normalizedUrl,
          canonicalUrl: pageCanonical,
          pageTitle: extracted.pageTitle,
          excerptText: extracted.excerpt,
          contentHash: contentHash(extracted.excerpt),
          extractionMethod: pageUsedRendered ? 'RENDERED_JS' : 'HEURISTIC',
          discoveredPageId: pageId,
        },
      });

      for (const field of extracted.fields) {
        await getPrisma().extractedObservation.create({
          data: {
            id: newId(),
            tenantId: input.tenantId,
            brandId: input.brandId,
            scanAttemptId: input.scanAttemptId,
            fieldKey: field.fieldKey,
            discoveryTier: discoveryTierForField(field.fieldKey) as never,
            valueJson: field.value === null ? null : JSON.stringify(field.value),
            isUnknown: field.isUnknown,
            infoState: 'OBSERVED',
            confidence: field.confidence,
            evidenceId,
          },
        });
      }

      for (const key of [productUrlKey(normalizedUrl), productUrlKey(pageCanonical)]) {
        if (key && !pageIdByKey.has(key)) pageIdByKey.set(key, pageId);
      }
      for (const product of extracted.products) {
        catalog.add(product, normalizedUrl);
      }

      pagesFetched += 1;
      await emitProgress({
        progressPercent: scanCrawlProgressPercent(pagesFetched, maxPages),
        status: 'CRAWLING',
        pagesFetched,
        pagesFailed,
        pagesSkipped,
      });

      if (current.depth < maxDepth && !extracted.nofollow) {
        for (const link of extracted.links) {
          if (link.rel.includes('nofollow')) continue;
          try {
            const next = canonicalizeUrl(new URL(link.href, fetched.finalUrl).toString());
            if (isInCrawlScope(input.startUrl, next)) {
              const nextPath = new URL(next).pathname;
              const urgent =
                isProductDetailUrl(next) ||
                isProductLikePathname(nextPath) ||
                isCatalogLikePath(nextPath);
              enqueueCrawlUrl(queue, next, current.depth + 1, urgent, productPagesFirst);
            }
          } catch {
            // skip bad links
          }
        }
      }
    } catch {
      pagesFailed += 1;
    }
  }

  await emitProgress({
    progressPercent: scanCatalogProgressPercent(),
    status: 'EXTRACTING',
    pagesFetched,
    pagesFailed,
    pagesSkipped,
  });

  Object.assign(
    catalogStats,
    await persistCatalog({
      tenantId: input.tenantId,
      brandId: input.brandId,
      scanAttemptId: input.scanAttemptId,
      catalog,
      pageIdByKey,
    }),
  );

  await persistCatalogObservations({
    tenantId: input.tenantId,
    brandId: input.brandId,
    scanAttemptId: input.scanAttemptId,
  });

  const stopReason = inferCrawlStopReason({
    queueLength: queue.length,
    pagesFetched,
    maxPages,
    deadlineMs: deadline,
  });

  return {
    pagesFetched,
    pagesFailed,
    pagesSkipped,
    pagesJsRendered,
    pagesJsRenderAttempted,
    pagesJsRenderFailed,
    jsRenderErrors,
    jsRenderErrorDetails,
    jsRenderLaunchDetail,
    jsRenderMode,
    stopReason,
    catalog: catalogStats,
  };
}
