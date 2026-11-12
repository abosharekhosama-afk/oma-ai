import { getPrisma } from '@oma/db';
import {
  buildCatalogFieldValue,
  buildMarketingSeedUrls,
  buildSitemapSeedUrls,
  canonicalHash,
  canonicalizeUrl,
  contentHash,
  discoveryTierForField,
  extractFromHtml,
  isBrandFixtureConnectorEnabled,
  isCatalogLikePath,
  isInCrawlScope,
  newId,
  parseSitemapXml,
  resolveJsRenderMode,
  shouldAdoptRenderedExtraction,
  shouldUseJsRender,
  type WebsiteConnectorPort,
} from '@oma/domain';
import { fetchRenderedPageHtml, RenderedPageFetchError } from './rendered-page-fetch';

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
) {
  const entry = { url, depth };
  if (priority) {
    queue.unshift(entry);
    return;
  }
  try {
    const path = new URL(url).pathname;
    if (isCatalogLikePath(path)) queue.unshift(entry);
    else queue.push(entry);
  } catch {
    queue.push(entry);
  }
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

export async function runExtractionForScan(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  startUrl: string;
  connector: WebsiteConnectorPort;
  config?: CrawlConfig;
}) {
  const maxPages = input.config?.max_pages ?? Number(process.env.BRAND_MAX_PAGES ?? 50);
  const maxDepth = input.config?.max_depth ?? Number(process.env.BRAND_MAX_DEPTH ?? 3);
  const maxBytes = Number(process.env.BRAND_MAX_BYTES ?? 1_000_000);
  const maxSitemapDocuments = Number(process.env.BRAND_MAX_SITEMAP_DOCUMENTS ?? 5);
  const deadline = Date.now() + (input.config?.max_duration_seconds ?? 600) * 1000;

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
  const jsRenderMode = resolveJsRenderMode(process.env.BRAND_SCANNER_JS_RENDER_MODE);

  const recordJsRenderError = (code: string) => {
    if (!jsRenderErrors.includes(code) && jsRenderErrors.length < 5) {
      jsRenderErrors.push(code);
    }
  };

  const startHost = new URL(input.startUrl).host;
  try {
    const robotsInfo = await input.connector.inspectRobots(startHost);
    const seedTargets = fixtureCrawl
      ? [...robotsInfo.sitemaps]
      : [...new Set([...robotsInfo.sitemaps, ...buildSitemapSeedUrls(input.startUrl)])];
    const sitemapDocs = [...new Set(seedTargets)].slice(0, maxSitemapDocuments);
    let docsFetched = 0;
    while (sitemapDocs.length > 0 && docsFetched < maxSitemapDocuments && Date.now() < deadline) {
      const sitemapUrl = sitemapDocs.shift();
      if (!sitemapUrl) break;
      docsFetched += 1;
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

  while (queue.length > 0 && pagesFetched < maxPages && Date.now() < deadline) {
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
      let extracted = extractFromHtml(fetched.finalUrl, htmlBody);
      let pageUsedRendered = false;
      if (
        shouldUseJsRender({
          mode: jsRenderMode,
          html: htmlBody,
          pageUrl: normalizedUrl,
          productCount: extracted.products.length,
        })
      ) {
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
              renderedExtracted.products.length,
              renderedKnown,
            )
          ) {
            htmlBody = renderedHtml;
            extracted = renderedExtracted;
            pageUsedRendered = true;
            pagesJsRendered += 1;
          }
        } catch (err) {
          pagesJsRenderFailed += 1;
          const code =
            err instanceof RenderedPageFetchError
              ? err.code
              : err instanceof Error
                ? err.name
                : 'RENDER_FAILED';
          recordJsRenderError(code);
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

      for (const product of extracted.products) {
        const dedupeKey = `${product.kind}:${product.name}:${product.skuPublic ?? ''}`;
        await getPrisma().discoveredProductService.upsert({
          where: {
            scanAttemptId_dedupeKey: {
              scanAttemptId: input.scanAttemptId,
              dedupeKey,
            },
          },
          create: {
            id: newId(),
            tenantId: input.tenantId,
            brandId: input.brandId,
            scanAttemptId: input.scanAttemptId,
            kind: product.kind,
            name: product.name,
            description: product.description,
            category: product.category,
            skuPublic: product.skuPublic,
            priceAmount: product.priceAmount,
            priceCurrency: product.priceCurrency,
            availability: product.availability,
            sourcePageId: pageId,
            dedupeKey,
          },
          update: {},
        });
      }

      pagesFetched += 1;

      if (current.depth < maxDepth && !extracted.nofollow) {
        for (const link of extracted.links) {
          if (link.rel.includes('nofollow')) continue;
          try {
            const next = canonicalizeUrl(new URL(link.href, fetched.finalUrl).toString());
            if (isInCrawlScope(input.startUrl, next)) {
              enqueueCrawlUrl(queue, next, current.depth + 1);
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

  await persistCatalogObservations({
    tenantId: input.tenantId,
    brandId: input.brandId,
    scanAttemptId: input.scanAttemptId,
  });

  return {
    pagesFetched,
    pagesFailed,
    pagesSkipped,
    pagesJsRendered,
    pagesJsRenderAttempted,
    pagesJsRenderFailed,
    jsRenderErrors,
    jsRenderMode,
  };
}
