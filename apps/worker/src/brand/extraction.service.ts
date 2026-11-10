import { getPrisma } from '@oma/db';
import {
  canonicalHash,
  canonicalizeUrl,
  contentHash,
  discoveryTierForField,
  extractFromHtml,
  isInCrawlScope,
  newId,
  parseSitemapXml,
  type WebsiteConnectorPort,
} from '@oma/domain';

type CrawlConfig = {
  max_pages?: number;
  max_depth?: number;
  max_duration_seconds?: number;
};

function pagePath(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname || '/'}${parsed.search}`;
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
  const queue: { url: string; depth: number }[] = [{ url: input.startUrl, depth: 0 }];
  let pagesFetched = 0;
  let pagesFailed = 0;
  let pagesSkipped = 0;

  const startHost = new URL(input.startUrl).host;
  try {
    const robotsInfo = await input.connector.inspectRobots(startHost);
    const seedTargets = [
      ...robotsInfo.sitemaps,
      new URL('/sitemap.xml', input.startUrl).toString(),
    ];
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
            queue.push({ url: canonicalizeUrl(loc), depth: 1 });
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

      const extracted = extractFromHtml(fetched.finalUrl, fetched.body);
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
          extractionMethod: 'HEURISTIC',
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
              queue.push({ url: next, depth: current.depth + 1 });
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

  return { pagesFetched, pagesFailed, pagesSkipped };
}
