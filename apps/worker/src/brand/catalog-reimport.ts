import { getPrisma, tenantWhere } from '@oma/db';
import {
  extractFromHtml,
  isInCrawlScope,
  productMediaUrlCount,
  resolveJsRenderMode,
  shouldAdoptRenderedExtraction,
  shouldUseJsRender,
  type WebsiteConnectorPort,
} from '@oma/domain';
import { fetchRenderedPageHtml } from './rendered-page-fetch';
import { ingestProductMediaFromScan } from './catalog-product-media';

export async function reimportCatalogMediaForScan(input: {
  tenantId: string;
  brandId: string;
  scanAttemptId: string;
  connector: WebsiteConnectorPort;
}) {
  const scan = await getPrisma().scanAttempt.findFirst({
    where: tenantWhere(input.tenantId, { id: input.scanAttemptId, brandId: input.brandId }),
    include: { websiteSource: true, brand: { select: { name: true } } },
  });
  const startUrl = scan?.websiteSource?.normalizedUrl;
  if (!scan || !startUrl) return { products: 0, imported: 0, skipped: 0 };
  const brandName = scan.brand.name;

  const products = await getPrisma().discoveredProductService.findMany({
    where: { tenantId: input.tenantId, scanAttemptId: input.scanAttemptId, brandId: input.brandId },
  });

  const jsRenderMode = resolveJsRenderMode(process.env.BRAND_SCANNER_JS_RENDER_MODE);
  let imported = 0;
  let skipped = 0;

  for (const product of products) {
    if (!product.sourcePageId) {
      skipped++;
      continue;
    }
    const page = await getPrisma().discoveredPage.findFirst({
      where: { id: product.sourcePageId, tenantId: input.tenantId },
    });
    if (!page?.url) {
      skipped++;
      continue;
    }

    let html = '';
    try {
      const fetched = await input.connector.fetchPublic({ url: page.url, accept: 'html' });
      if (fetched.status < 200 || fetched.status >= 400 || !fetched.body) {
        skipped++;
        continue;
      }
      html = fetched.body;
      let extracted = extractFromHtml(fetched.finalUrl, html);
      if (
        shouldUseJsRender({
          mode: jsRenderMode,
          html,
          pageUrl: page.url,
          productCount: extracted.products.length,
        })
      ) {
        try {
          const renderedHtml = await fetchRenderedPageHtml(fetched.finalUrl);
          const rendered = extractFromHtml(fetched.finalUrl, renderedHtml);
          const staticKnown = extracted.fields.filter((f) => !f.isUnknown).length;
          const renderedKnown = rendered.fields.filter((f) => !f.isUnknown).length;
          if (
            shouldAdoptRenderedExtraction(
              jsRenderMode,
              extracted.products.length,
              staticKnown,
              productMediaUrlCount(extracted.products),
              rendered.products.length,
              renderedKnown,
              productMediaUrlCount(rendered.products),
            )
          ) {
            html = renderedHtml;
            extracted = rendered;
          }
        } catch {
          /* keep static html */
        }
      }

      const match =
        extracted.products.find(
          (p) =>
            p.name.trim().toLowerCase() === product.name.trim().toLowerCase() &&
            p.kind === product.kind,
        ) ??
        extracted.products.find(
          (p) => p.name.trim().toLowerCase() === product.name.trim().toLowerCase(),
        );

      if (!match?.media?.length) {
        skipped++;
        continue;
      }

      if (!isInCrawlScope(startUrl, page.url)) {
        skipped++;
        continue;
      }

      const res = await ingestProductMediaFromScan({
        tenantId: input.tenantId,
        brandId: input.brandId,
        brandName,
        discoveredProductId: product.id,
        productName: product.name,
        media: match.media,
      });
      imported += res.imported;
      skipped += res.skipped;
    } catch {
      skipped++;
    }
  }

  return { products: products.length, imported, skipped };
}
