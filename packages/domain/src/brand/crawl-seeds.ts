/** Common marketing/catalog paths and sitemap locations for broader public crawls. */

export const DEFAULT_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/wp-sitemap.xml',
  '/sitemap/sitemap-index.xml',
  '/sitemap/index.xml',
] as const;

export const DEFAULT_MARKETING_PATH_SEEDS = [
  '/products',
  '/product',
  '/collections',
  '/shop',
  '/store',
  '/catalog',
  '/catalogue',
  '/items',
  '/item',
  '/services',
  '/service',
  '/solutions',
  '/offerings',
  '/portfolio',
  '/pricing',
  '/plans',
  '/about',
  '/about-us',
  '/faq',
  '/help',
  '/contact',
  '/contact-us',
  '/menu',
  '/categories',
  '/منتجات',
  '/منتج',
  '/خدمات',
  '/خدمة',
  '/متجر',
  '/تسوق',
  '/عروض',
] as const;

/** Path segments that suggest catalog or service listing pages — enqueue with priority. */
export const CATALOG_PATH_PATTERN =
  /\/(products?|product-category|collections?|shop|store|catalog(?:ue)?|items?|services?|solutions?|offerings?|portfolio|pricing|plans|menu|categories|متجر|منتجات|منتج|خدمات|خدمة|تسوق|عروض)(\/|$)/iu;

const LOW_VALUE_CRAWL_PATTERN =
  /\/(privacy|terms|legal|cookie|cookies|gdpr|blog|news|press|careers|jobs|login|sign-?in|signup|sign-up|register|account|cart|checkout|wishlist|cdn-cgi)(\/|$)/i;

function marketingSeedsDisabled(env: NodeJS.ProcessEnv): boolean {
  const raw = env.BRAND_SCANNER_MARKETING_SEEDS?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return true;
  const paths = env.BRAND_SCANNER_PATH_SEEDS?.trim().toLowerCase();
  return paths === '0' || paths === 'off' || paths === 'false' || paths === 'none';
}

export function marketingSeedPathsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return !marketingSeedsDisabled(env);
}

/** Decode percent-encoding so `/عروض` seeds match crawled `/%D8%B9%D8%B1%D9%88%D8%B6`. */
export function normalizePathnameForComparison(pathname: string): string {
  let path = (pathname || '/').replace(/\/+$/, '') || '/';
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep encoded segment when malformed
  }
  return path || '/';
}

export function isMarketingSeedPathname(pathname: string, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!marketingSeedPathsEnabled(env)) return false;
  const normalized = normalizePathnameForComparison(pathname);
  const raw = env.BRAND_SCANNER_PATH_SEEDS?.trim();
  const paths = raw ? parseExtraPathSeeds(env) : [...DEFAULT_MARKETING_PATH_SEEDS];
  return paths.some((p) => normalizePathnameForComparison(p) === normalized);
}

export function marketingSeedDeferThreshold(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.BRAND_SCANNER_MARKETING_SEEDS_MIN_SITEMAP_URLS ?? '12');
  return Number.isFinite(n) && n >= 0 ? n : 12;
}

export function parseExtraPathSeeds(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.BRAND_SCANNER_PATH_SEEDS?.trim();
  if (!raw) return marketingSeedsDisabled(env) ? [] : [...DEFAULT_MARKETING_PATH_SEEDS];
  if (marketingSeedsDisabled(env)) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith('/') ? part : `/${part}`));
}

export function buildMarketingSeedUrls(
  startUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (!marketingSeedPathsEnabled(env)) return [];
  let base: URL;
  try {
    base = new URL(startUrl);
  } catch {
    return [];
  }
  const paths = parseExtraPathSeeds(env);
  const urls = new Set<string>();
  for (const path of paths) {
    try {
      urls.add(new URL(path, base).toString());
    } catch {
      // skip
    }
  }
  return [...urls];
}

export function buildSitemapSeedUrls(startUrl: string): string[] {
  let base: URL;
  try {
    base = new URL(startUrl);
  } catch {
    return [];
  }
  return DEFAULT_SITEMAP_PATHS.map((path) => new URL(path, base).toString());
}

export function isCatalogLikePath(pathname: string): boolean {
  return CATALOG_PATH_PATTERN.test(pathname);
}

export function isLowValueCrawlPath(pathname: string): boolean {
  return LOW_VALUE_CRAWL_PATTERN.test(pathname);
}

/**
 * Broad product/service discovery signal for crawl priority and JS-render policy
 * (not a guarantee the page is a single product).
 */
export function isProductLikePathname(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  if (isCatalogLikePath(pathname)) return true;
  if (isLowValueCrawlPath(pathname)) return false;
  return /\/(p\/|portfolio\/|offering\/|listing\/)/i.test(pathname);
}
