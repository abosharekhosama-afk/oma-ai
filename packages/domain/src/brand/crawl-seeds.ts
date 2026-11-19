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
  /\/(privacy|terms|legal|cookie|cookies|gdpr|blog|news|press|careers|jobs|login|sign-?in|signup|sign-up|register|account|cart|checkout|wishlist)(\/|$)/i;

export function parseExtraPathSeeds(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.BRAND_SCANNER_PATH_SEEDS?.trim();
  if (!raw) return [...DEFAULT_MARKETING_PATH_SEEDS];
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
