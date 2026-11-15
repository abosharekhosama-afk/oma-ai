import type { CatalogProductMedia, DiscoveredProduct } from './brand-types';

export type GalleryItem = {
  id: string;
  kind: 'image' | 'video';
  src: string;
  /** Poster/stream URL for video items; null for images. */
  streamUrl: string | null;
  role: string;
  generated: boolean;
};

const ROLE_RANK: Record<string, number> = {
  SCAN_THUMBNAIL: 0,
  SCAN_IMAGE: 1,
  SCAN_VIDEO: 2,
  GENERATED_IMAGE: 3,
  GENERATED_VIDEO: 4,
  GENERATED_SHORT_VIDEO: 5,
};

/** Scan media is shown as captured; generated media only once a human approved it. */
export function isPublishableMedia(m: CatalogProductMedia): boolean {
  if (m.review_status === 'REJECTED') return false;
  if (m.status === 'MISSING') return false;
  if (!m.mime.startsWith('image/') && !m.mime.startsWith('video/')) return false;
  return m.role.startsWith('SCAN_') || m.review_status === 'APPROVED';
}

/**
 * Every displayable product image/video, in the order the scan captured them:
 * thumbnail first, then scan images/videos by sort order, then approved generated media.
 * The same WorkDrive asset can be linked under several roles (e.g. thumbnail + image after a
 * re-import); it is shown once.
 */
export function productGallery(media: CatalogProductMedia[] | undefined | null): GalleryItem[] {
  const usable = (media ?? []).filter(isPublishableMedia);
  // Sort key: scan before generated, thumbnail first, then crawl order, then role.
  const sortKey = (m: CatalogProductMedia): [number, number, number, number] => [
    m.role.startsWith('GENERATED_') ? 1 : 0,
    m.role === 'SCAN_THUMBNAIL' ? 0 : 1,
    m.sort_order,
    ROLE_RANK[m.role] ?? 9,
  ];
  const sorted = [...usable].sort((a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i]! - kb[i]!;
    }
    return 0;
  });
  const seen = new Set<string>();
  const out: GalleryItem[] = [];
  for (const m of sorted) {
    const key = m.view_url;
    if (seen.has(key)) continue;
    seen.add(key);
    const video = m.mime.startsWith('video/');
    out.push({
      id: m.id,
      kind: video ? 'video' : 'image',
      src: video ? (m.stream_url ?? m.view_url) : m.view_url,
      streamUrl: video ? (m.stream_url ?? m.view_url) : null,
      role: m.role,
      generated: m.role.startsWith('GENERATED_'),
    });
  }
  return out;
}

export function pendingGeneratedMedia(media: CatalogProductMedia[] | undefined | null) {
  return (media ?? []).filter(
    (m) => m.review_status === 'PENDING' && m.role.startsWith('GENERATED_'),
  );
}

const AVAILABILITY_KEYS: Record<string, string> = {
  instock: 'brand.discovery.availabilityValue.inStock',
  outofstock: 'brand.discovery.availabilityValue.outOfStock',
  soldout: 'brand.discovery.availabilityValue.outOfStock',
  preorder: 'brand.discovery.availabilityValue.preOrder',
  presale: 'brand.discovery.availabilityValue.preOrder',
  backorder: 'brand.discovery.availabilityValue.backOrder',
  limitedavailability: 'brand.discovery.availabilityValue.limited',
  discontinued: 'brand.discovery.availabilityValue.discontinued',
  onlineonly: 'brand.discovery.availabilityValue.onlineOnly',
  instoreonly: 'brand.discovery.availabilityValue.inStoreOnly',
};

/**
 * schema.org availability arrives as `https://schema.org/InStock`, `InStock`, or `in_stock`.
 * Returns an i18n key for known values, or null so the caller shows the site's own text.
 */
export function availabilityKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const tail = raw.trim().split(/[/#]/).pop() ?? '';
  const norm = tail.toLowerCase().replace(/[^a-z]/g, '');
  return AVAILABILITY_KEYS[norm] ?? null;
}

export function availabilityTone(
  raw: string | null | undefined,
): 'success' | 'warning' | 'danger' | 'neutral' {
  const key = availabilityKey(raw);
  if (!key) return 'neutral';
  if (key.endsWith('inStock') || key.endsWith('onlineOnly') || key.endsWith('inStoreOnly'))
    return 'success';
  if (key.endsWith('outOfStock') || key.endsWith('discontinued')) return 'danger';
  return 'warning';
}

/** Locale-aware price; falls back to the raw amount + currency when Intl cannot format it. */
export function formatProductPrice(
  amount: string | null | undefined,
  currency: string | null | undefined,
  locale: string,
): string | null {
  if (!amount || !amount.trim()) return null;
  const value = Number(amount.replace(/,/g, ''));
  const code = currency?.trim().toUpperCase() ?? '';
  if (Number.isFinite(value) && /^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: value % 1 === 0 ? 0 : 2,
      }).format(value);
    } catch {
      /* unknown ISO code — fall through */
    }
  }
  return [amount.trim(), code].filter(Boolean).join(' ');
}

/**
 * True when a photo is so much taller/wider than the square card frame that cropping it
 * (object-fit: cover) would cut the product; such photos are letterboxed instead.
 */
export function needsLetterbox(width: number, height: number): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  return ratio < 0.72 || ratio > 1.4;
}

/**
 * Carousel keyboard handling. ArrowRight means "next" in LTR and "previous" in RTL so the
 * key always moves in the direction it points.
 */
export function carouselKeyTarget(
  key: string,
  current: number,
  count: number,
  dir: 'ltr' | 'rtl',
): number | null {
  if (count <= 0) return null;
  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
  switch (key) {
    case forward:
      return Math.min(count - 1, current + 1);
    case backward:
      return Math.max(0, current - 1);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

export type ProductFilter = {
  query: string;
  kind: '' | 'PRODUCT' | 'SERVICE';
  withMediaOnly: boolean;
};

export function filterProducts(products: DiscoveredProduct[], filter: ProductFilter) {
  const q = filter.query.trim().toLowerCase();
  return products.filter((p) => {
    if (filter.kind && p.kind !== filter.kind) return false;
    if (filter.withMediaOnly && productGallery(p.media).length === 0) return false;
    if (!q) return true;
    return [p.name, p.description, p.category, p.sku_public]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });
}

export function catalogStats(products: DiscoveredProduct[]) {
  let withMedia = 0;
  let mediaTotal = 0;
  let pendingReview = 0;
  let services = 0;
  for (const p of products) {
    const gallery = productGallery(p.media);
    if (gallery.length) withMedia++;
    mediaTotal += gallery.length;
    pendingReview += pendingGeneratedMedia(p.media).length;
    if (p.kind === 'SERVICE') services++;
  }
  return {
    total: products.length,
    products: products.length - services,
    services,
    withMedia,
    mediaTotal,
    pendingReview,
  };
}
