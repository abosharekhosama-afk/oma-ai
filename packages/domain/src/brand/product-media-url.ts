import type { ExtractedProductMedia } from './product-values';

/** Default per-product cap for scanned media (images + videos). */
export const DEFAULT_MAX_PRODUCT_MEDIA = 20;

/** Query parameters that only resize / re-encode an image on a CDN. */
const SIZE_QUERY_PARAMS = new Set([
  'w',
  'h',
  'width',
  'height',
  'size',
  'sz',
  'resize',
  'fit',
  'crop',
  'quality',
  'q',
  'format',
  'fm',
  'auto',
  'dpr',
  'scale',
  'v',
  'ver',
  'version',
  'imwidth',
  'im',
]);

/**
 * Shopify-style size suffixes before the extension: `_100x`, `_x200`, `_100x200`,
 * `_grande`, `_large@2x`, `_100x100_crop_center` …
 */
const SHOPIFY_SIZE_SUFFIX =
  /_(?:\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande|original|master)(?:_crop_[a-z]+)?(?:@\dx)?(?=\.[a-z0-9]{2,5}$)/i;

/** WordPress-style generated thumbnails: `image-300x300.jpg`, `image-scaled.jpg`. */
const WORDPRESS_SIZE_SUFFIX = /-(?:\d{2,4}x\d{2,4}|scaled)(?=\.[a-z0-9]{2,5}$)/i;

/** Non-product imagery: brand marks, UI chrome, trackers, payment badges, placeholders. */
const NON_PRODUCT_IMAGE_PATTERN =
  /(?:^|[/_.-])(?:logo|logos|favicon|sprite|icons?|icon-|placeholder|no[-_]?image|spacer|pixel|tracking|loader|loading|spinner|avatar|badge|payment|visa|mastercard|master-card|amex|paypal|apple[-_]?pay|google[-_]?pay|mada|stc[-_]?pay|tabby|tamara|cash[-_]?on[-_]?delivery|whatsapp|facebook|instagram|twitter|tiktok|snapchat|youtube|linkedin)(?:[/_.-]|$)/i;

const IMAGE_EXT = /\.(?:jpe?g|png|webp|gif|avif)$/i;
const VIDEO_EXT = /\.(?:mp4|webm|mov|m4v)$/i;

function safeUrl(raw: string, base?: string): URL | null {
  try {
    return base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
}

/**
 * Returns the URL to download (largest/original variant when the CDN encodes a size in the
 * path) — the query string is kept as-is because some CDNs require it for access.
 */
export function originalMediaUrl(raw: string, base?: string): string | null {
  const url = safeUrl(raw.trim(), base);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;
  const isShopifyCdn =
    url.hostname === 'cdn.shopify.com' ||
    url.hostname.endsWith('.myshopify.com') ||
    url.pathname.includes('/cdn/shop/');
  if (isShopifyCdn) {
    url.pathname = url.pathname.replace(SHOPIFY_SIZE_SUFFIX, '');
    url.searchParams.delete('width');
    url.searchParams.delete('height');
    url.searchParams.delete('crop');
  }
  if (/\/wp-content\/uploads\//i.test(url.pathname)) {
    url.pathname = url.pathname.replace(WORDPRESS_SIZE_SUFFIX, '');
  }
  url.hash = '';
  return url.toString();
}

/**
 * Stable identity for de-duplication: host + path without CDN size markers and without
 * resize-only query params. Two renditions of the same picture share one key.
 */
export function mediaIdentityKey(raw: string, base?: string): string | null {
  const original = originalMediaUrl(raw, base);
  if (!original) return null;
  const url = new URL(original);
  url.pathname = url.pathname
    .replace(SHOPIFY_SIZE_SUFFIX, '')
    .replace(WORDPRESS_SIZE_SUFFIX, '')
    .replace(/\/+/g, '/');
  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !SIZE_QUERY_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : '';
  return `${url.hostname.toLowerCase().replace(/^www\./, '')}${decodeURIComponent(url.pathname).toLowerCase()}${query}`;
}

export type MediaHints = {
  /** Rendered/declared width or height in CSS px (from attributes), when known. */
  width?: number | null;
  height?: number | null;
  alt?: string | null;
};

/** Minimum declared size (px) for an image to be considered product imagery. */
const MIN_DECLARED_SIZE = 80;

/** True when the URL or hints point at chrome (logo, icon, tracker, payment badge …). */
export function isNonProductMedia(raw: string, hints: MediaHints = {}): boolean {
  const url = safeUrl(raw);
  if (!url) return true;
  if (url.protocol === 'data:' || url.protocol === 'blob:') return true;
  const path = decodeURIComponent(url.pathname).toLowerCase();
  if (path.endsWith('.svg') || path.endsWith('.ico')) return true;
  if (NON_PRODUCT_IMAGE_PATTERN.test(path)) return true;
  const { width, height } = hints;
  if (
    (typeof width === 'number' && width > 0 && width < MIN_DECLARED_SIZE) ||
    (typeof height === 'number' && height > 0 && height < MIN_DECLARED_SIZE)
  ) {
    return true;
  }
  return false;
}

export function guessMediaKind(raw: string): 'IMAGE' | 'VIDEO' | null {
  const url = safeUrl(raw);
  if (!url) return null;
  const path = url.pathname.toLowerCase();
  if (VIDEO_EXT.test(path)) return 'VIDEO';
  if (IMAGE_EXT.test(path)) return 'IMAGE';
  return null;
}

/**
 * Normalises, filters and de-duplicates a product's media list while preserving order.
 * Videos are kept (they are capped by the same limit); chrome imagery is dropped.
 */
export function curateProductMedia(
  items: Array<ExtractedProductMedia & { hints?: MediaHints }>,
  options: { base?: string; cap?: number } = {},
): ExtractedProductMedia[] {
  const cap = Math.max(1, options.cap ?? DEFAULT_MAX_PRODUCT_MEDIA);
  const out: ExtractedProductMedia[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (out.length >= cap) break;
    if (!item?.url) continue;
    const original = originalMediaUrl(item.url, options.base);
    if (!original) continue;
    if (isNonProductMedia(original, item.hints)) continue;
    const key = mediaIdentityKey(original);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: item.kind, url: original });
  }
  return out;
}

export function maxProductMediaFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.BRAND_MAX_PRODUCT_MEDIA);
  if (Number.isFinite(raw) && raw >= 1) return Math.min(Math.floor(raw), 50);
  return DEFAULT_MAX_PRODUCT_MEDIA;
}
