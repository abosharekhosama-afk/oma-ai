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
  '/services',
  '/service',
  '/solutions',
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
] as const;

/** Path segments that suggest catalog or service listing pages — enqueue with priority. */
export const CATALOG_PATH_PATTERN =
  /\/(products?|product-category|collections?|shop|store|catalog|services?|solutions|pricing|plans|menu|categories)(\/|$)/i;

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
