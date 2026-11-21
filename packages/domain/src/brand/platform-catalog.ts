import { parse as parseHtml } from 'node-html-parser';
import { curateProductMedia, DEFAULT_MAX_PRODUCT_MEDIA, guessMediaKind } from './product-media-url';
import {
  cleanText,
  htmlToPlainText,
  minorUnitsToAmount,
  normalizeAvailability,
  normalizeCurrency,
  normalizePriceAmount,
  SOURCE_CONFIDENCE,
  type ExtractedProduct,
  type ExtractedProductMedia,
  type ProductAttribute,
} from './product-values';

/**
 * Public storefront catalogs. When a site runs on a platform with a public product API we
 * read the catalog from it (complete, ordered images, real prices) instead of guessing from
 * HTML. Every adapter is read-only, unauthenticated, and bounded by the caller.
 */
export type StorefrontPlatform = 'shopify' | 'woocommerce' | 'salla' | 'zid' | 'igroup';

export type IgroupStorefrontConfig = { apiUrl: string; companyId: string; siteId: string };

export type PlatformDetection = {
  platform: StorefrontPlatform;
  /** Short human-readable reason (logged + stored with the scan diagnostics). */
  evidence: string;
  currencyHint?: string;
  igroup?: IgroupStorefrontConfig;
};

/** Platforms whose public catalog API we read; Salla/Zid expose JSON-LD on product pages. */
export const API_BACKED_PLATFORMS: ReadonlySet<StorefrontPlatform> = new Set([
  'shopify',
  'woocommerce',
  'igroup',
]);

export function detectStorefrontPlatform(html: string): PlatformDetection | null {
  const head = html.slice(0, 600_000);
  if (/cdn\.shopify\.com|Shopify\.shop\s*=|myshopify\.com|shopify-section/i.test(head)) {
    return {
      platform: 'shopify',
      evidence: 'shopify markers in HTML',
      currencyHint: shopifyCurrencyHint(head),
    };
  }
  if (/wp-content\/plugins\/woocommerce|woocommerce-(page|product|no-js)|wc-block-/i.test(head)) {
    return { platform: 'woocommerce', evidence: 'woocommerce markers in HTML' };
  }
  if (/cdn\.salla\.(sa|network)|salla\.sa\/|window\.salla|salla-/i.test(head)) {
    return { platform: 'salla', evidence: 'salla markers in HTML' };
  }
  if (/zid\.store|zidcdn|media\.zid\.store|window\.zid/i.test(head)) {
    return { platform: 'zid', evidence: 'zid markers in HTML' };
  }
  if (/VITE_IGROUP_|igroup-api|api\.igroup\.|\/-\/[cp]\d{6,}|redirect\/pages\/\d+/i.test(head)) {
    return { platform: 'igroup', evidence: 'igroup / headless storefront markers in HTML' };
  }
  return null;
}

function shopifyCurrencyHint(html: string): string | undefined {
  const active = html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/);
  if (active) return active[1];
  const meta = html.match(/(?:og|product):price:currency"\s+content="([A-Z]{3})"/i);
  return meta?.[1]?.toUpperCase();
}

/** Same-origin module/entry scripts of an SPA shell (where storefront config is compiled in). */
export function sameOriginScriptUrls(html: string, pageUrl: string, max = 2): string[] {
  const root = parseHtml(html);
  const origin = new URL(pageUrl).origin;
  const out: string[] = [];
  for (const script of root.querySelectorAll('script[src]')) {
    try {
      const url = new URL(script.getAttribute('src') ?? '', pageUrl);
      if (url.origin !== origin) continue;
      if (!/\.m?js$/i.test(url.pathname)) continue;
      const isModule = (script.getAttribute('type') ?? '').toLowerCase() === 'module';
      if (isModule) out.unshift(url.toString());
      else out.push(url.toString());
    } catch {
      // skip
    }
  }
  return [...new Set(out)].slice(0, max);
}

function jsConfigValue(js: string, key: string): string | undefined {
  const re = new RegExp(`${key}\\s*:\\s*(?:\`([^\`]{1,200})\`|"([^"]{1,200})"|'([^']{1,200})')`);
  const m = js.match(re);
  return (m?.[1] ?? m?.[2] ?? m?.[3])?.trim() || undefined;
}

/** iGroup headless storefronts compile their public tenant config into the SPA bundle. */
export function detectIgroupConfig(js: string): IgroupStorefrontConfig | null {
  const apiUrl = jsConfigValue(js, 'VITE_IGROUP_API_URL');
  const companyId = jsConfigValue(js, 'VITE_IGROUP_COMPANY_ID');
  const siteId = jsConfigValue(js, 'VITE_IGROUP_SITE_ID');
  if (!apiUrl || !companyId || !siteId) return null;
  try {
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:') return null;
    if (!/^[\w.-]{1,80}$/.test(companyId) || !/^[\w.-]{1,80}$/.test(siteId)) return null;
    return { apiUrl: url.origin, companyId, siteId };
  } catch {
    return null;
  }
}

/* --------------------------------- Shopify ------------------------------------------------ */

export function shopifyProductsUrl(origin: string, page: number, limit = 250): string {
  return `${origin}/products.json?limit=${limit}&page=${page}`;
}

type ShopifyProduct = {
  id?: number | string;
  title?: string;
  handle?: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  tags?: string[] | string;
  variants?: Array<{
    sku?: string;
    price?: string | number;
    compare_at_price?: string | number | null;
    available?: boolean;
  }>;
  images?: Array<{ src?: string; position?: number }>;
  media?: Array<{ media_type?: string; sources?: Array<{ url?: string; mime_type?: string }> }>;
};

export function parseShopifyProducts(
  json: unknown,
  origin: string,
  options: { currency?: string; cap?: number } = {},
): ExtractedProduct[] {
  const list = (json as { products?: ShopifyProduct[] } | null)?.products;
  if (!Array.isArray(list)) return [];
  const cap = options.cap ?? DEFAULT_MAX_PRODUCT_MEDIA;
  const out: ExtractedProduct[] = [];
  for (const p of list) {
    const name = cleanText(p.title, 200);
    if (!name || !p.handle) continue;
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const priced = variants
      .map((v) => ({ v, price: normalizePriceAmount(String(v.price ?? '')) }))
      .filter((x) => x.price)
      .sort((a, b) => Number(a.price) - Number(b.price));
    const cheapest = priced[0];
    const compareAt = normalizePriceAmount(String(cheapest?.v.compare_at_price ?? ''));
    const images = [...(p.images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const media: ExtractedProductMedia[] = images
      .filter((img) => img.src)
      .map((img) => ({ kind: 'IMAGE' as const, url: img.src! }));
    for (const m of p.media ?? []) {
      if (m.media_type !== 'video') continue;
      const mp4 = m.sources?.find((s) => s.mime_type === 'video/mp4')?.url;
      if (mp4) media.push({ kind: 'VIDEO', url: mp4 });
    }
    const tags = Array.isArray(p.tags)
      ? p.tags
      : typeof p.tags === 'string'
        ? p.tags.split(',')
        : [];
    const attributes: ProductAttribute[] = [];
    if (p.vendor) attributes.push({ label: 'brand', value: cleanText(p.vendor, 120)! });
    if (tags.length) attributes.push({ label: 'tags', value: cleanText(tags.join(' · '), 300)! });
    out.push({
      kind: 'PRODUCT',
      name,
      description: htmlToPlainText(p.body_html),
      category: cleanText(p.product_type, 120),
      skuPublic: cleanText(variants.find((v) => v.sku)?.sku, 120),
      priceAmount: cheapest?.price,
      priceCurrency: options.currency,
      compareAtPrice:
        compareAt && cheapest?.price && Number(compareAt) > Number(cheapest.price)
          ? compareAt
          : undefined,
      availability: variants.length
        ? normalizeAvailability(variants.some((v) => v.available !== false))
        : undefined,
      media: curateProductMedia(media, { base: origin, cap }),
      sourceUrl: `${origin}/products/${encodeURIComponent(p.handle)}`,
      platformId: p.id != null ? `shopify:${p.id}` : undefined,
      variantCount: variants.length > 1 ? variants.length : undefined,
      attributes,
      extractionSource: 'PLATFORM_API',
      confidence: SOURCE_CONFIDENCE.PLATFORM_API,
    });
  }
  return out;
}

/* ------------------------------- WooCommerce ---------------------------------------------- */

export function wooStoreProductsUrl(origin: string, page: number, perPage = 100): string {
  return `${origin}/wp-json/wc/store/v1/products?per_page=${perPage}&page=${page}`;
}

type WooProduct = {
  id?: number;
  name?: string;
  slug?: string;
  permalink?: string;
  sku?: string;
  description?: string;
  short_description?: string;
  prices?: {
    price?: string;
    regular_price?: string;
    sale_price?: string;
    currency_code?: string;
    currency_minor_unit?: number;
  };
  is_in_stock?: boolean;
  images?: Array<{ src?: string }>;
  categories?: Array<{ name?: string }>;
  variations?: unknown[];
  attributes?: Array<{ name?: string; terms?: Array<{ name?: string }> }>;
};

export function parseWooStoreProducts(
  json: unknown,
  origin: string,
  options: { cap?: number } = {},
): ExtractedProduct[] {
  if (!Array.isArray(json)) return [];
  const cap = options.cap ?? DEFAULT_MAX_PRODUCT_MEDIA;
  const out: ExtractedProduct[] = [];
  for (const p of json as WooProduct[]) {
    const name = cleanText(htmlToPlainText(p.name), 200);
    if (!name) continue;
    const unit = p.prices?.currency_minor_unit;
    const price = minorUnitsToAmount(p.prices?.price, unit);
    const regular = minorUnitsToAmount(p.prices?.regular_price, unit);
    const description = htmlToPlainText(p.description) ?? htmlToPlainText(p.short_description);
    const attributes: ProductAttribute[] = [];
    for (const attr of p.attributes ?? []) {
      const label = cleanText(attr.name, 60);
      const value = cleanText(
        (attr.terms ?? [])
          .map((t) => t.name)
          .filter(Boolean)
          .join(' · '),
        300,
      );
      if (label && value) attributes.push({ label, value });
    }
    out.push({
      kind: 'PRODUCT',
      name,
      description,
      category: cleanText(p.categories?.map((c) => c.name).filter(Boolean)[0], 120),
      skuPublic: cleanText(p.sku, 120),
      priceAmount: price,
      priceCurrency: normalizeCurrency(p.prices?.currency_code),
      compareAtPrice: regular && price && Number(regular) > Number(price) ? regular : undefined,
      availability: normalizeAvailability(p.is_in_stock),
      media: curateProductMedia(
        (p.images ?? []).filter((i) => i.src).map((i) => ({ kind: 'IMAGE' as const, url: i.src! })),
        { base: origin, cap },
      ),
      sourceUrl: p.permalink ?? (p.slug ? `${origin}/product/${p.slug}/` : undefined),
      platformId: p.id != null ? `woocommerce:${p.id}` : undefined,
      variantCount: p.variations?.length || undefined,
      attributes,
      extractionSource: 'PLATFORM_API',
      confidence: SOURCE_CONFIDENCE.PLATFORM_API,
    });
  }
  return out;
}

/* ---------------------------------- iGroup ------------------------------------------------ */

export function igroupContentUrl(config: IgroupStorefrontConfig, locale: string): string {
  return `${config.apiUrl}/api/storefront/content?locale=${encodeURIComponent(locale)}`;
}

export function igroupHeaders(config: IgroupStorefrontConfig): Record<string, string> {
  return { 'X-Company-Id': config.companyId, 'X-Site-Id': config.siteId };
}

type Localized = Record<string, string | undefined> | string | null | undefined;

function pickLocale(value: Localized, locale: string): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  const preferred = value[locale]?.trim();
  if (preferred) return preferred;
  for (const v of Object.values(value)) if (v?.trim()) return v.trim();
  return undefined;
}

type IgroupLabel = { id?: string; label?: Localized };

type IgroupProduct = {
  id?: string;
  slug?: string;
  sku?: string;
  name?: Localized;
  shortDescription?: Localized;
  description?: Localized;
  price?: number | string;
  originalPrice?: number | string | null;
  categoryId?: string;
  mainCategoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  image?: string;
  hoverImage?: string;
  usageVideo?: string;
  gallery?: string[];
  galleryItems?: Array<{ url?: string; sortOrder?: number }>;
  variants?: Array<{ image?: string; stock?: number; price?: number }>;
  stock?: number;
  availability?: Localized;
  filterAttributes?: Record<string, IgroupLabel[] | undefined>;
};

const IGROUP_ATTRIBUTE_LABELS: Record<string, { ar: string; en: string }> = {
  age: { ar: 'العمر', en: 'Age' },
  gender: { ar: 'الجنس', en: 'Gender' },
  skill: { ar: 'المهارات', en: 'Skills' },
  occasion: { ar: 'المناسبة', en: 'Occasion' },
  material: { ar: 'الخامة', en: 'Material' },
  productType: { ar: 'نوع المنتج', en: 'Product type' },
  theme: { ar: 'الموضوع', en: 'Theme' },
  collection: { ar: 'المجموعة', en: 'Collection' },
};

export function parseIgroupContent(
  json: unknown,
  options: {
    siteOrigin: string;
    locale: string;
    expected: IgroupStorefrontConfig;
    cap?: number;
  },
): ExtractedProduct[] {
  const data = json as {
    site?: { id?: string; companyId?: string; currency?: string };
    products?: IgroupProduct[];
    categories?: Array<{ id?: string; name?: Localized }>;
    brands?: Array<{ id?: string; name?: Localized }>;
  } | null;
  if (!data || !Array.isArray(data.products)) return [];
  // Refuse content for a different tenant (same check the storefront itself performs).
  if (
    data.site?.companyId !== options.expected.companyId ||
    data.site?.id !== options.expected.siteId
  )
    return [];
  const { locale } = options;
  const cap = options.cap ?? DEFAULT_MAX_PRODUCT_MEDIA;
  const categoryName = new Map<string, string>();
  for (const c of data.categories ?? []) {
    const label = pickLocale(c.name, locale);
    if (c.id && label) categoryName.set(c.id, label);
  }
  const brandName = new Map<string, string>();
  for (const b of data.brands ?? []) {
    const label = pickLocale(b.name, locale);
    if (b.id && label) brandName.set(b.id, label);
  }
  const currency = normalizeCurrency(data.site?.currency);
  const out: ExtractedProduct[] = [];
  for (const p of data.products) {
    const name = cleanText(pickLocale(p.name, locale), 200);
    const slug = p.slug ?? p.id;
    if (!name || !slug) continue;
    const ordered = [...(p.galleryItems ?? [])]
      .filter((g) => g.url)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((g) => g.url!);
    const imageUrls = [p.image, ...ordered, ...(p.gallery ?? []), p.hoverImage]
      .concat((p.variants ?? []).map((v) => v.image))
      .filter((u): u is string => Boolean(u && u.trim()));
    const media: ExtractedProductMedia[] = imageUrls.map((url) => ({ kind: 'IMAGE', url }));
    if (p.usageVideo && guessMediaKind(p.usageVideo) === 'VIDEO') {
      media.push({ kind: 'VIDEO', url: p.usageVideo });
    }
    const main = p.mainCategoryId ? categoryName.get(p.mainCategoryId) : undefined;
    const sub = categoryName.get(p.subcategoryId ?? p.categoryId ?? '');
    const category = main && sub && main !== sub ? `${main} › ${sub}` : (sub ?? main);
    const attributes: ProductAttribute[] = [];
    const brand = p.brandId ? brandName.get(p.brandId) : undefined;
    if (brand) attributes.push({ label: 'brand', value: brand });
    for (const [key, values] of Object.entries(p.filterAttributes ?? {})) {
      const labels = (values ?? []).map((v) => pickLocale(v.label, locale)).filter(Boolean);
      if (!labels.length) continue;
      const label = IGROUP_ATTRIBUTE_LABELS[key]?.[locale === 'ar' ? 'ar' : 'en'] ?? key;
      attributes.push({ label, value: cleanText(labels.join(' · '), 300)! });
    }
    const variantStock = (p.variants ?? []).reduce((n, v) => n + (Number(v.stock) || 0), 0);
    const stock = Number(p.stock ?? 0) || variantStock;
    const price = normalizePriceAmount(p.price);
    const original = normalizePriceAmount(p.originalPrice ?? undefined);
    out.push({
      kind: 'PRODUCT',
      name,
      description:
        htmlToPlainText(pickLocale(p.description, locale)) ??
        htmlToPlainText(pickLocale(p.shortDescription, locale)),
      category: cleanText(category, 160),
      skuPublic: cleanText(p.sku, 120),
      priceAmount: price,
      priceCurrency: currency,
      compareAtPrice: original && price && Number(original) > Number(price) ? original : undefined,
      availability:
        normalizeAvailability(pickLocale(p.availability, locale)) ??
        normalizeAvailability(stock > 0),
      media: curateProductMedia(media, { base: options.siteOrigin, cap }),
      sourceUrl: `${options.siteOrigin}/products/${encodeURIComponent(slug)}`,
      platformId: p.id ? `igroup:${p.id}` : undefined,
      variantCount: (p.variants?.length ?? 0) > 1 ? p.variants!.length : undefined,
      attributes,
      extractionSource: 'PLATFORM_API',
      confidence: SOURCE_CONFIDENCE.PLATFORM_API,
    });
  }
  return out;
}
