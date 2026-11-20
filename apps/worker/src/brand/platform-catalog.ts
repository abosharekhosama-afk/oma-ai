import {
  API_BACKED_PLATFORMS,
  detectIgroupConfig,
  detectStorefrontPlatform,
  igroupContentUrl,
  igroupHeaders,
  parseIgroupContent,
  parseShopifyProducts,
  parseWooStoreProducts,
  sameOriginScriptUrls,
  shopifyProductsUrl,
  wooStoreProductsUrl,
  looksLikeSpaShell,
  type ExtractedProduct,
  type PlatformDetection,
  type WebsiteConnectorPort,
} from '@oma/domain';

export type PlatformCatalogResult = {
  detection: PlatformDetection | null;
  products: ExtractedProduct[];
  requests: number;
  error: string | null;
};

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function pathOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function htmlLang(html: string): string | null {
  const match = html.match(/<html[^>]*\blang=["']?([a-zA-Z-]{2,10})/i);
  return match?.[1]?.slice(0, 2).toLowerCase() ?? null;
}

/**
 * Detects the storefront platform from the start page (and, for SPA shells, its first-party
 * bundle) and reads the public product catalog when the platform exposes one.
 * Best-effort: any failure falls back to page-by-page extraction.
 */
export async function fetchPlatformCatalog(input: {
  startUrl: string;
  homeHtml: string;
  connector: WebsiteConnectorPort;
  deadline: number;
  maxProducts: number;
  mediaCap: number;
}): Promise<PlatformCatalogResult> {
  if (
    process.env.BRAND_PLATFORM_ADAPTERS === '0' ||
    process.env.BRAND_PLATFORM_ADAPTERS === 'false'
  ) {
    return { detection: null, products: [], requests: 0, error: null };
  }
  const origin = new URL(input.startUrl).origin;
  const maxBytes = envNumber('BRAND_PLATFORM_API_MAX_BYTES', 16_000_000);
  const maxPages = envNumber('BRAND_PLATFORM_API_MAX_PAGES', 8);
  let requests = 0;
  let detection = detectStorefrontPlatform(input.homeHtml);

  const needsIgroupBundle =
    (!detection && looksLikeSpaShell(input.homeHtml)) ||
    (detection?.platform === 'igroup' && !detection.igroup);

  if (needsIgroupBundle) {
    const scriptCap = envNumber('BRAND_PLATFORM_SCRIPT_BUNDLES', 5);
    for (const scriptUrl of sameOriginScriptUrls(input.homeHtml, input.startUrl, scriptCap)) {
      if (Date.now() > input.deadline) break;
      try {
        requests += 1;
        const res = await input.connector.fetchPublic({
          url: scriptUrl,
          accept: 'script',
          maxBytes: envNumber('BRAND_PLATFORM_SCRIPT_MAX_BYTES', 6_000_000),
        });
        if (res.status >= 400) continue;
        const config = detectIgroupConfig(res.body);
        if (config) {
          detection = {
            platform: 'igroup',
            evidence: 'iGroup storefront config in bundle',
            igroup: config,
          };
          break;
        }
      } catch {
        // bundle not readable — keep going
      }
    }
  }

  if (!detection || !API_BACKED_PLATFORMS.has(detection.platform)) {
    return { detection, products: [], requests, error: null };
  }

  const products: ExtractedProduct[] = [];
  try {
    if (detection.platform === 'shopify') {
      for (let page = 1; page <= maxPages && products.length < input.maxProducts; page++) {
        if (Date.now() > input.deadline) break;
        const url = shopifyProductsUrl(origin, page);
        if ((await input.connector.evaluateRobots(new URL(url).host, pathOf(url))) === 'DISALLOW')
          break;
        requests += 1;
        const res = await input.connector.fetchPublic({ url, accept: 'json', maxBytes });
        if (res.status >= 400) break;
        const batch = parseShopifyProducts(JSON.parse(res.body), origin, {
          currency: detection.currencyHint,
          cap: input.mediaCap,
        });
        if (!batch.length) break;
        products.push(...batch);
      }
    } else if (detection.platform === 'woocommerce') {
      for (let page = 1; page <= maxPages && products.length < input.maxProducts; page++) {
        if (Date.now() > input.deadline) break;
        const url = wooStoreProductsUrl(origin, page);
        if ((await input.connector.evaluateRobots(new URL(url).host, pathOf(url))) === 'DISALLOW')
          break;
        requests += 1;
        const res = await input.connector.fetchPublic({ url, accept: 'json', maxBytes });
        if (res.status >= 400) break;
        const batch = parseWooStoreProducts(JSON.parse(res.body), origin, { cap: input.mediaCap });
        if (!batch.length) break;
        products.push(...batch);
      }
    } else if (detection.platform === 'igroup' && detection.igroup) {
      const locales = [...new Set([htmlLang(input.homeHtml) ?? 'en', 'ar', 'en'])].filter(
        Boolean,
      ) as string[];
      for (const locale of locales) {
        if (products.length >= input.maxProducts || Date.now() > input.deadline) break;
        const url = igroupContentUrl(detection.igroup, locale);
        const host = new URL(url).host;
        if ((await input.connector.evaluateRobots(host, pathOf(url))) === 'DISALLOW') continue;
        requests += 1;
        const res = await input.connector.fetchPublic({
          url,
          accept: 'json',
          maxBytes,
          headers: igroupHeaders(detection.igroup),
        });
        if (res.status >= 400) continue;
        const batch = parseIgroupContent(JSON.parse(res.body), {
          siteOrigin: origin,
          locale,
          expected: detection.igroup,
          cap: input.mediaCap,
        });
        if (batch.length > products.length) {
          products.length = 0;
          products.push(...batch);
        }
      }
    }
  } catch (err) {
    return {
      detection,
      products: products.slice(0, input.maxProducts),
      requests,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 300),
    };
  }
  return { detection, products: products.slice(0, input.maxProducts), requests, error: null };
}
