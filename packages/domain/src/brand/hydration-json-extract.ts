import { parse as parseHtml } from 'node-html-parser';
import type { ExtractedProduct, ProductExtractionSource } from './product-values';

type JsonRecord = Record<string, unknown>;

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function walkProductCandidates(
  value: unknown,
  pageUrl: string,
  out: ExtractedProduct[],
  seen: Set<string>,
  depth: number,
): void {
  if (depth > 12 || out.length >= 80) return;
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) walkProductCandidates(item, pageUrl, out, seen, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  const record = value as JsonRecord;
  const name =
    asString(record.name) ??
    asString(record.title) ??
    asString(record.productTitle) ??
    asString(record.displayName);
  const hasProductHint =
    name &&
    name.length >= 2 &&
    name.length <= 240 &&
    (record['@type'] === 'Product' ||
      asString(record.sku) ||
      asString(record.price) ||
      asString(record.priceAmount) ||
      record.offers ||
      record.variants ||
      record.images ||
      record.image);
  if (hasProductHint && name) {
    const key = `${name.toLowerCase()}|${asString(record.id) ?? ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      let sourceUrl = asString(record.url) ?? asString(record.link) ?? asString(record.href);
      if (sourceUrl) {
        try {
          sourceUrl = new URL(sourceUrl, pageUrl).toString();
        } catch {
          sourceUrl = pageUrl;
        }
      } else {
        sourceUrl = pageUrl;
      }
      const price =
        asString(record.price) ??
        asString(record.priceAmount) ??
        (typeof record.offers === 'object' && record.offers
          ? asString((record.offers as JsonRecord).price)
          : undefined);
      const images: string[] = [];
      const pushImage = (img: unknown) => {
        const url = asString(img) ?? (typeof img === 'object' && img ? asString((img as JsonRecord).url) : undefined);
        if (url) {
          try {
            images.push(new URL(url, pageUrl).toString());
          } catch {
            // skip
          }
        }
      };
      if (Array.isArray(record.images)) record.images.forEach(pushImage);
      else if (record.image) pushImage(record.image);
      out.push({
        kind: 'PRODUCT',
        name,
        description: asString(record.description) ?? asString(record.body_html),
        skuPublic: asString(record.sku) ?? asString(record.id),
        priceAmount: price?.replace(/[^\d.,]/g, '') || price,
        priceCurrency: asString(record.priceCurrency) ?? asString(record.currency),
        sourceUrl,
        media: images.slice(0, 8).map((url) => ({ kind: 'IMAGE' as const, url })),
        extractionSource: 'HYDRATION_JSON' as ProductExtractionSource,
        confidence: 0.86,
      });
    }
  }
  for (const child of Object.values(record)) {
    if (child && typeof child === 'object') walkProductCandidates(child, pageUrl, out, seen, depth + 1);
  }
}

function collectEmbeddedJsonDocuments(html: string): unknown[] {
  const root = parseHtml(html, { lowerCaseTagName: true });
  const docs: unknown[] = [];
  const next = root.querySelector('script#__NEXT_DATA__')?.text?.trim();
  if (next) {
    const parsed = safeJsonParse(next);
    if (parsed) docs.push(parsed);
  }
  const nuxt = root.querySelector('script#__NUXT_DATA__')?.text?.trim();
  if (nuxt) {
    const parsed = safeJsonParse(nuxt);
    if (parsed) docs.push(parsed);
  }
  for (const script of root.querySelectorAll(
    'script[type="application/json"], script[type="application/ld+json"]',
  )) {
    const text = script.text?.trim();
    if (!text || text.length > 2_000_000) continue;
    const parsed = safeJsonParse(text);
    if (parsed) docs.push(parsed);
  }
  return docs;
}

/** Parse common SPA bootstrap JSON without executing JavaScript in a browser. */
export function extractHydrationProducts(pageUrl: string, html: string): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];
  const seen = new Set<string>();
  for (const doc of collectEmbeddedJsonDocuments(html)) {
    walkProductCandidates(doc, pageUrl, products, seen, 0);
  }
  return products;
}