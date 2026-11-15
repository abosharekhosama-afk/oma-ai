import { isProductDetailUrl, mergeProductRecords } from './product-detection';
import { productNameKey, type ExtractedProduct } from './product-values';

const LOCALE_SEGMENT = /^[a-z]{2}(?:-[a-z]{2})?$/i;

/**
 * Locale- and query-insensitive key for a product page:
 * `https://shop.test/ar/products/Foo?variant=1` → `shop.test/products/foo`.
 */
export function productUrlKey(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s).toLowerCase());
  while (segments.length > 1 && LOCALE_SEGMENT.test(segments[0]!)) segments.shift();
  if (isProductDetailUrl(raw) && segments.length >= 2) {
    const productId = url.searchParams.get('product_id');
    if (productId) return `${host}/product_id/${productId}`;
    // Collections often nest the product: /collections/x/products/handle → /products/handle
    const idx = segments.findIndex((s) => /^(products?|item|items|p|product-page)$/.test(s));
    if (idx >= 0 && idx < segments.length - 1) {
      return `${host}/${segments[idx]!.replace(/s$/, '')}/${segments[segments.length - 1]}`;
    }
  }
  const productId = url.searchParams.get('product_id');
  if (productId) return `${host}/product_id/${productId}`;
  return `${host}/${segments.join('/')}`;
}

type Keys = { pid?: string; url?: string; sku?: string; name: string };

function keysOf(product: ExtractedProduct): Keys {
  return {
    pid: product.platformId?.toLowerCase(),
    url: productUrlKey(product.sourceUrl) ?? undefined,
    sku: product.skuPublic?.trim().toLowerCase() || undefined,
    name: `${product.kind}:${productNameKey(product.name)}`,
  };
}

function conflicting(a: Keys, b: Keys): boolean {
  if (a.pid && b.pid && a.pid !== b.pid) return true;
  if (a.url && b.url && a.url !== b.url) return true;
  return false;
}

function matches(a: Keys, b: Keys): boolean {
  if (conflicting(a, b)) return false;
  if (a.pid && a.pid === b.pid) return true;
  if (a.url && a.url === b.url) return true;
  if (a.sku && a.sku === b.sku) return true;
  return a.name === b.name;
}

/** Stable per-scan dedupe key (strongest identity available). */
export function productDedupeKey(product: ExtractedProduct): string {
  const keys = keysOf(product);
  const key = keys.pid
    ? `pid:${keys.pid}`
    : keys.url && product.kind === 'PRODUCT' && isProductDetailUrl(product.sourceUrl ?? '')
      ? `url:${keys.url}`
      : keys.sku
        ? `sku:${keys.sku}`
        : `name:${keys.name}`;
  return key.slice(0, 480);
}

export type CatalogEntry = {
  product: ExtractedProduct;
  /** Crawled page URLs where this product was observed (first = its own page when known). */
  pageUrls: string[];
};

/**
 * Collects products from every source (platform API, structured data, rendered detail pages)
 * and merges records that describe the same product. Records are never merged across
 * different URLs or platform ids, so media can't be pooled onto a single item.
 */
export class ProductCatalogAccumulator {
  private readonly entries: Array<CatalogEntry & { keys: Keys }> = [];

  constructor(private readonly maxProducts = 1000) {}

  get size(): number {
    return this.entries.length;
  }

  add(product: ExtractedProduct, pageUrl?: string): CatalogEntry | null {
    const keys = keysOf(product);
    const existing = this.entries.find((entry) => matches(entry.keys, keys));
    if (existing) {
      existing.product = mergeProductRecords(existing.product, product);
      existing.keys = keysOf(existing.product);
      // Keep identifiers learned from either side.
      existing.keys.pid ??= keys.pid;
      existing.keys.url ??= keys.url;
      existing.keys.sku ??= keys.sku;
      if (pageUrl && !existing.pageUrls.includes(pageUrl)) {
        const own = productUrlKey(pageUrl) === existing.keys.url;
        if (own) existing.pageUrls.unshift(pageUrl);
        else existing.pageUrls.push(pageUrl);
      }
      return existing;
    }
    if (this.entries.length >= this.maxProducts) return null;
    const entry = { product, pageUrls: pageUrl ? [pageUrl] : [], keys };
    this.entries.push(entry);
    return entry;
  }

  has(product: ExtractedProduct): boolean {
    const keys = keysOf(product);
    return this.entries.some((entry) => matches(entry.keys, keys));
  }

  list(): CatalogEntry[] {
    return this.entries.map(({ product, pageUrls }) => ({ product, pageUrls }));
  }
}

export type CatalogCoverage = {
  total: number;
  products: number;
  services: number;
  withMedia: number;
  withDescription: number;
  withPrice: number;
  withCategory: number;
  withAvailability: number;
  mediaTotal: number;
};

export function catalogCoverage(
  rows: Array<{
    kind: string;
    description?: string | null;
    priceAmount?: string | null;
    category?: string | null;
    availability?: string | null;
    mediaCount?: number;
  }>,
): CatalogCoverage {
  const c: CatalogCoverage = {
    total: rows.length,
    products: 0,
    services: 0,
    withMedia: 0,
    withDescription: 0,
    withPrice: 0,
    withCategory: 0,
    withAvailability: 0,
    mediaTotal: 0,
  };
  for (const row of rows) {
    if (row.kind === 'SERVICE') c.services++;
    else c.products++;
    if ((row.mediaCount ?? 0) > 0) c.withMedia++;
    c.mediaTotal += row.mediaCount ?? 0;
    if (row.description?.trim()) c.withDescription++;
    if (row.priceAmount?.trim()) c.withPrice++;
    if (row.category?.trim()) c.withCategory++;
    if (row.availability?.trim()) c.withAvailability++;
  }
  return c;
}
