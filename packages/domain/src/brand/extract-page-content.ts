import { extractFromHtml, type ExtractedField, type ExtractedLink, type ExtractedProduct } from './extractors';
import { extractHydrationProducts } from './hydration-json-extract';
import { productDedupeKey } from './product-catalog';
import type { PageProductKind } from './product-detection';

export type PageExtraction = ReturnType<typeof extractFromHtml>;

function mergeProducts(staticProducts: ExtractedProduct[], extra: ExtractedProduct[]): ExtractedProduct[] {
  if (extra.length === 0) return staticProducts;
  const keys = new Set(staticProducts.map((p) => productDedupeKey(p)));
  const merged = [...staticProducts];
  for (const product of extra) {
    const key = productDedupeKey(product);
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(product);
  }
  return merged;
}

/**
 * Static HTML extraction plus embedded hydration JSON (no Chromium).
 * Hydration products supplement the DOM/JSON-LD parse when catalog fields are thin.
 */
export function extractPageContent(url: string, html: string): PageExtraction {
  const base = extractFromHtml(url, html);
  const hydration = extractHydrationProducts(url, html);
  const staticMedia = base.products.reduce((n, p) => n + (p.media?.length ?? 0), 0);
  const hydrationMedia = hydration.reduce((n, p) => n + (p.media?.length ?? 0), 0);
  const shouldMerge =
    hydration.length > 0 &&
    (base.products.length === 0 ||
      hydration.length > base.products.length ||
      (base.products.length > 0 && staticMedia === 0 && hydrationMedia > 0));
  if (!shouldMerge) return base;
  const products = mergeProducts(base.products, hydration);
  return { ...base, products };
}

export type { ExtractedField, ExtractedLink, ExtractedProduct, PageProductKind };