import { getPrisma } from '@oma/db';
import {
  canonicalHash,
  contentHash,
  discoveryTierForField,
  extractFromHtml,
  newId,
  type WebsiteConnectorPort,
} from '@oma/domain';
import { evaluateRobotsPath } from './robots-policy';

type CrawlConfig = {
  max_pages?: number;
  max_depth?: number;
  max_duration_seconds?: number;
};

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
  const deadline = Date.now() + (input.config?.max_duration_seconds ?? 600) * 1000;

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: input.startUrl, depth: 0 }];
  let pagesFetched = 0;
  let pagesFailed = 0;
  let pagesSkipped = 0;

  while (queue.length > 0 && pagesFetched < maxPages && Date.now() < deadline) {
    const current = queue.shift();
    if (!current) break;
    const hash = canonicalHash(current.url);
    if (visited.has(hash)) continue;
    visited.add(hash);

    const path = new URL(current.url).pathname;
    const robots = evaluateRobotsPath(path);
    if (robots === 'DISALLOW') {
      pagesSkipped += 1;
      await getPrisma().discoveredPage.create({
        data: {
          id: newId(),
          tenantId: input.tenantId,
          brandId: input.brandId,
          scanAttemptId: input.scanAttemptId,
          url: current.url,
          canonicalUrl: current.url,
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
        url: current.url,
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
            url: current.url,
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
      const pageId = newId();
      await getPrisma().discoveredPage.create({
        data: {
          id: pageId,
          tenantId: input.tenantId,
          brandId: input.brandId,
          scanAttemptId: input.scanAttemptId,
          url: current.url,
          canonicalUrl: fetched.finalUrl,
          canonicalHash: canonicalHash(fetched.finalUrl),
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
          sourceUrl: current.url,
          canonicalUrl: fetched.finalUrl,
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

      if (current.depth < maxDepth) {
        const linkRe = /href=["']([^"'#]+)["']/gi;
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(fetched.body))) {
          const href = m[1];
          if (!href) continue;
          try {
            const next = new URL(href, fetched.finalUrl).toString();
            if (next.startsWith(new URL(input.startUrl).origin)) {
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
