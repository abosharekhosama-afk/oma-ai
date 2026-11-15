import type { HTMLElement } from 'node-html-parser';
import {
  curateProductMedia,
  DEFAULT_MAX_PRODUCT_MEDIA,
  guessMediaKind,
  type MediaHints,
} from './product-media-url';
import {
  cleanText,
  htmlToPlainText,
  normalizeAvailability,
  normalizeCurrency,
  normalizePriceAmount,
  parsePriceText,
  productNameKey,
  SOURCE_CONFIDENCE,
  type ExtractedProduct,
  type ExtractedProductMedia,
  type ProductAttribute,
} from './product-values';

export type PageProductKind = 'PRODUCT_DETAIL' | 'LISTING' | 'SERVICE' | 'OTHER';

export type PageProductDetection = {
  products: ExtractedProduct[];
  pageKind: PageProductKind;
};

type MediaCandidate = ExtractedProductMedia & { hints?: MediaHints };

/* ------------------------------------------------------------------------------------------ */
/* URL patterns                                                                                */
/* ------------------------------------------------------------------------------------------ */

const LISTING_WORDS =
  /^(all|new|sale|search|category|categories|collections?|tags?|brands?|page|shop|store|catalog|catalogue|products?|items?|p)$/i;

/**
 * True for URLs that look like a single product's page on common platforms:
 * `/products/<handle>` (Shopify, custom SPAs), `/product/<slug>` (WooCommerce),
 * `/p/<id>`, `/<slug>/p123456` (Salla), `/item/<id>`, `/shop/<cat>/<slug>`,
 * `?product_id=` / `route=product/product` (OpenCart).
 */
export function isProductDetailUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.searchParams.has('product_id') || url.searchParams.get('route') === 'product/product') {
    return true;
  }
  const segments = url.pathname
    .split('/')
    .map((s) => decodeURIComponent(s).trim())
    .filter(Boolean);
  if (segments.length === 0) return false;
  const last = segments[segments.length - 1]!;
  if (/^p\d{3,}$/i.test(last)) return true; // Salla
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!.toLowerCase();
    if (/^(products?|product-page|item|items|p|منتج|المنتجات|منتجات)$/.test(seg)) {
      const rest = segments.slice(i + 1);
      // `/products/<handle>` but not `/products/category/x` or `/products/page/2`
      if (rest.length === 1 && !LISTING_WORDS.test(rest[0]!)) return true;
      if (rest.length >= 2 && !LISTING_WORDS.test(rest[0]!) && seg !== 'p') return false;
    }
  }
  return false;
}

/** True for collection / category / shop listing URLs. */
export function isListingUrl(raw: string): boolean {
  try {
    const path = new URL(raw).pathname.toLowerCase();
    if (isProductDetailUrl(raw)) return false;
    return /\/(collections?|categories|category|product-category|shop|store|catalog|catalogue|products?|brands?|tags?)(\/|$)/.test(
      path,
    );
  } catch {
    return false;
  }
}

function isServicePath(raw: string): boolean {
  try {
    const path = new URL(raw).pathname.toLowerCase();
    return path.includes('service') || path.includes('solution');
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------------------------------ */
/* JSON-LD                                                                                     */
/* ------------------------------------------------------------------------------------------ */

function typeList(node: Record<string, unknown>): string[] {
  const raw = node['@type'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((item) =>
    String(item)
      .toLowerCase()
      .replace(/^.*[/#]/, ''),
  );
}

function asArray<T = unknown>(value: unknown): T[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value]) as T[];
}

function ldString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return ldString(rec['@value'] ?? rec.name ?? rec.url ?? rec.contentUrl ?? rec['@id']);
  }
  return undefined;
}

function absolute(raw: string | undefined, base: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function ldMedia(node: Record<string, unknown>, base: string): MediaCandidate[] {
  const out: MediaCandidate[] = [];
  for (const item of asArray(node.image).concat(asArray(node.photo))) {
    const url = absolute(
      typeof item === 'object' && item
        ? ldString(
            (item as Record<string, unknown>).contentUrl ?? (item as Record<string, unknown>).url,
          )
        : ldString(item),
      base,
    );
    if (url) out.push({ kind: 'IMAGE', url });
  }
  for (const item of asArray(node.video)) {
    const rec = (typeof item === 'object' && item ? item : {}) as Record<string, unknown>;
    const url = absolute(ldString(rec.contentUrl ?? rec.embedUrl ?? item), base);
    if (url && guessMediaKind(url) === 'VIDEO') out.push({ kind: 'VIDEO', url });
  }
  return out;
}

type LdOffer = { price?: string; currency?: string; availability?: string; compareAt?: string };

function ldOffer(node: Record<string, unknown>): LdOffer {
  const offers = asArray<Record<string, unknown>>(node.offers).filter(
    (o) => o && typeof o === 'object',
  );
  const candidates: LdOffer[] = [];
  for (const offer of offers) {
    const types = typeList(offer);
    const nested = asArray<Record<string, unknown>>(offer.offers).filter(
      (o) => o && typeof o === 'object',
    );
    if (types.includes('aggregateoffer')) {
      candidates.push({
        price: normalizePriceAmount(offer.lowPrice ?? offer.price),
        currency: normalizeCurrency(offer.priceCurrency),
        availability: normalizeAvailability(offer.availability),
      });
      for (const n of nested) {
        candidates.push({
          price: normalizePriceAmount(n.price ?? n.lowPrice),
          currency: normalizeCurrency(n.priceCurrency ?? offer.priceCurrency),
          availability: normalizeAvailability(n.availability),
        });
      }
      continue;
    }
    const spec = asArray<Record<string, unknown>>(offer.priceSpecification).find(
      (p) => p && typeof p === 'object',
    );
    candidates.push({
      price: normalizePriceAmount(offer.price ?? spec?.price),
      currency: normalizeCurrency(offer.priceCurrency ?? spec?.priceCurrency),
      availability: normalizeAvailability(offer.availability),
      compareAt: normalizePriceAmount(
        (offer as Record<string, unknown>).highPrice ??
          asArray<Record<string, unknown>>(offer.priceSpecification).find((p) =>
            /strikethrough|listprice|msrp/i.test(String(p?.priceType ?? '')),
          )?.price,
      ),
    });
  }
  const priced = candidates.filter((c) => c.price);
  priced.sort((a, b) => Number(a.price) - Number(b.price));
  const best = priced[0] ?? candidates[0] ?? {};
  const inStock = candidates.some((c) => c.availability === 'InStock');
  const compareAt =
    best.compareAt && best.price && Number(best.compareAt) > Number(best.price)
      ? best.compareAt
      : undefined;
  return {
    ...best,
    availability: inStock ? 'InStock' : best.availability,
    compareAt,
  };
}

function ldCategory(node: Record<string, unknown>): string | undefined {
  const raw = asArray(node.category)
    .map((c) => ldString(c))
    .filter(Boolean) as string[];
  if (!raw.length) return undefined;
  // Google taxonomy paths ("Toys > Puzzles") — keep the most specific level.
  const first = raw[0]!;
  const parts = first.split(/\s*[>›/]\s*/).filter(Boolean);
  return cleanText(parts[parts.length - 1] ?? first, 120);
}

function ldAttributes(node: Record<string, unknown>): ProductAttribute[] {
  const out: ProductAttribute[] = [];
  const brand = ldString(node.brand);
  if (brand) out.push({ label: 'brand', value: brand });
  for (const prop of asArray<Record<string, unknown>>(node.additionalProperty)) {
    const label = cleanText(prop?.name, 60);
    const value = cleanText(prop?.value, 200);
    if (label && value) out.push({ label, value });
  }
  for (const key of ['color', 'material', 'size', 'audience', 'model'] as const) {
    const value = ldString(node[key]);
    if (value) out.push({ label: key, value: cleanText(value, 200)! });
  }
  return out.slice(0, 20);
}

function productFromLd(
  node: Record<string, unknown>,
  pageUrl: string,
  cap: number,
): ExtractedProduct | null {
  const types = typeList(node);
  const isGroup = types.includes('productgroup');
  const isProduct =
    isGroup || types.some((t) => ['product', 'individualproduct', 'productmodel'].includes(t));
  if (!isProduct) return null;
  const name = cleanText(ldString(node.name), 200);
  if (!name || isGenericLabel(name)) return null;
  const variants = asArray<Record<string, unknown>>(node.hasVariant).filter(
    (v) => v && typeof v === 'object',
  );
  let offer = ldOffer(node);
  const media: MediaCandidate[] = ldMedia(node, pageUrl);
  const variantOffers = variants.map((variant) => {
    media.push(...ldMedia(variant, pageUrl));
    return ldOffer(variant);
  });
  if (!offer.price) {
    // ProductGroup: "from" price = cheapest variant; in stock when any variant is.
    const cheapest = variantOffers
      .filter((o) => o.price)
      .sort((a, b) => Number(a.price) - Number(b.price))[0];
    if (cheapest) {
      const anyInStock = variantOffers.some((o) => o.availability === 'InStock');
      offer = { ...cheapest, availability: anyInStock ? 'InStock' : cheapest.availability };
    }
  }
  const sku =
    ldString(node.sku) ??
    ldString(node.mpn) ??
    ldString(node.gtin13) ??
    ldString(node.gtin) ??
    ldString(node.productID) ??
    ldString(node.productGroupID);
  return {
    kind: 'PRODUCT',
    name,
    description: htmlToPlainText(ldString(node.description)),
    category: ldCategory(node),
    skuPublic: cleanText(sku, 120),
    priceAmount: offer.price,
    priceCurrency: offer.currency,
    compareAtPrice: offer.compareAt,
    availability: offer.availability,
    media: curateProductMedia(media, { base: pageUrl, cap }),
    sourceUrl: absolute(ldString(node.url), pageUrl),
    variantCount: variants.length || undefined,
    attributes: ldAttributes(node),
    extractionSource: 'JSON_LD',
    confidence: SOURCE_CONFIDENCE.JSON_LD,
  };
}

function serviceFromLd(node: Record<string, unknown>): ExtractedProduct | null {
  const types = typeList(node);
  if (!types.some((t) => t === 'service' || t.endsWith('service'))) return null;
  const name = cleanText(ldString(node.name), 200);
  if (!name) return null;
  return {
    kind: 'SERVICE',
    name,
    description: htmlToPlainText(ldString(node.description)),
    category: cleanText(ldString(node.serviceType ?? node.category), 120),
    extractionSource: 'JSON_LD',
    confidence: 0.8,
  };
}

export function productsFromJsonLd(
  nodes: Record<string, unknown>[],
  pageUrl: string,
  cap = DEFAULT_MAX_PRODUCT_MEDIA,
): ExtractedProduct[] {
  const out: ExtractedProduct[] = [];
  const consider = (node: Record<string, unknown>) => {
    const product = productFromLd(node, pageUrl, cap) ?? serviceFromLd(node);
    if (product) out.push(product);
  };
  // Accept raw script payloads too: expand `@graph` containers (each node visited once).
  const seen = new Set<Record<string, unknown>>();
  const flat: Record<string, unknown>[] = [];
  const expand = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(expand);
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (seen.has(record)) return;
    seen.add(record);
    flat.push(record);
    if (record['@graph']) expand(record['@graph']);
  };
  expand(nodes);
  for (const node of flat) {
    const types = typeList(node);
    if (types.includes('breadcrumblist')) continue; // never products
    consider(node);
    if (types.includes('offer')) {
      const item = node.itemOffered;
      if (item && typeof item === 'object') consider(item as Record<string, unknown>);
    }
    if (types.includes('itemlist') || types.includes('offercatalog')) {
      for (const el of asArray<Record<string, unknown>>(node.itemListElement)) {
        if (!el || typeof el !== 'object') continue;
        const nested = (el.item && typeof el.item === 'object' ? el.item : el) as Record<
          string,
          unknown
        >;
        const before = out.length;
        consider(nested);
        if (out.length > before) continue;
        // Name-only entries are offering lists on service pages, never shop listings
        // (those link to detail pages that are crawled separately).
        const name = cleanText(ldString(nested.name), 200);
        const hasUrl = Boolean(ldString(nested.url) ?? ldString(el.url));
        if (name && !hasUrl && isServicePath(pageUrl)) {
          out.push({
            kind: 'SERVICE',
            name,
            description: htmlToPlainText(ldString(nested.description)),
            extractionSource: 'JSON_LD',
            confidence: 0.55,
          });
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* DOM helpers                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/** Sections that never hold the current product's own data. */
const EXCLUDE_TOKENS =
  /(related|recommend|similar|upsell|up-sell|cross-?sell|you-?may|also-?(like|bought|viewed)|frequently|recently|recent-?view|viewed|(^|[\s_-])(site-)?header([\s_-]|$)|footer|navbar|(^|[\s_-])nav([\s_-]|$)|(^|[\s_-])menu|mega-?menu|breadcrumb|reviews?([\s_-]|$)|testimonial|newsletter|banner|announcement|(^|[\s_-])hero|(^|[\s_-])logo|payment|(^|[\s_-])share|social|product-card|product-item|productcard|product-grid|products-grid|product-list([\s_-]|$)|grid-item|card-product|collection-list|cart-drawer|mini-?cart|popup|modal|cookie)/i;

/** Containers that hold the current product's own pictures. */
const GALLERY_TOKENS =
  /(gallery|thumbnails?|thumbs|focal|zoom|lightbox|product[-_]?(images?|img|photos?|media|gallery|slider|carousel|thumbs?)|product__media|product-single__media|main-image|featured-image|woocommerce-product-gallery)/i;

const EXCLUDED_TAGS = new Set(['header', 'footer', 'nav', 'aside', 'dialog']);

function tokensOf(el: HTMLElement): string {
  return `${el.getAttribute('class') ?? ''} ${el.getAttribute('id') ?? ''}`.trim().toLowerCase();
}

function parentEl(el: HTMLElement): HTMLElement | null {
  const parent = el.parentNode as HTMLElement | null;
  return parent && parent.nodeType === 1 ? parent : null;
}

/** Walks up from `el`; the nearest gallery/exclusion signal decides. */
function mediaDecision(el: HTMLElement, stop: HTMLElement | null): 'include' | 'exclude' | null {
  let cur: HTMLElement | null = el;
  while (cur) {
    const tag = cur.tagName?.toLowerCase() ?? '';
    const tokens = tokensOf(cur);
    if (tokens) {
      if (GALLERY_TOKENS.test(tokens)) return 'include';
      if (EXCLUDE_TOKENS.test(tokens)) return 'exclude';
    }
    if (EXCLUDED_TAGS.has(tag)) return 'exclude';
    if (cur === stop) break;
    cur = parentEl(cur);
  }
  return null;
}

/** True when `el` sits inside chrome or another product's section. */
function isExcluded(el: HTMLElement, stop: HTMLElement | null = null): boolean {
  let cur: HTMLElement | null = el;
  while (cur) {
    const tag = cur.tagName?.toLowerCase() ?? '';
    if (EXCLUDED_TAGS.has(tag)) return true;
    const tokens = tokensOf(cur);
    if (tokens && EXCLUDE_TOKENS.test(tokens) && !GALLERY_TOKENS.test(tokens)) return true;
    if (cur === stop) break;
    cur = parentEl(cur);
  }
  return false;
}

function textOf(el: HTMLElement | null | undefined): string {
  return (el?.text ?? '').replace(/\s+/g, ' ').trim();
}

const GENERIC_LABELS =
  /^(featured|new|new arrival|sale|hot|best ?sellers?|top|trending|sold out|مميز|مميزة|جديد|وصل حديثا|خصم|تخفيض|عرض|عروض|الأكثر مبيعا|الأكثر مبيعاً|نفدت الكمية|منتجات|المنتجات|products?|shop|المتجر|home|الرئيسية)$/i;

export function isGenericLabel(name: string): boolean {
  return GENERIC_LABELS.test(name.trim());
}

function numericAttr(el: HTMLElement, name: string): number | null {
  const raw = el.getAttribute(name);
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

function largestFromSrcset(srcset: string | undefined): string | null {
  if (!srcset) return null;
  let best: { url: string; size: number } | null = null;
  for (const part of srcset.split(',')) {
    const [url, descriptor] = part.trim().split(/\s+/);
    if (!url || url.startsWith('data:')) continue;
    const size = descriptor ? Number.parseFloat(descriptor) || 1 : 1;
    if (!best || size > best.size) best = { url, size };
  }
  return best?.url ?? null;
}

function imageUrlOf(img: HTMLElement): string | null {
  const direct = [
    'data-zoom-image',
    'data-large_image',
    'data-large-image',
    'data-full',
    'data-full-src',
    'data-original',
    'data-src',
    'data-lazy-src',
    'data-image',
    'src',
  ]
    .map((attr) => img.getAttribute(attr)?.trim())
    .find((v) => v && !v.startsWith('data:'));
  return (
    largestFromSrcset(img.getAttribute('data-srcset') ?? img.getAttribute('srcset')) ??
    direct ??
    null
  );
}

function domMedia(
  container: HTMLElement,
  pageUrl: string,
  productName: string,
  cap: number,
  scope: HTMLElement = container,
): ExtractedProductMedia[] {
  const nameKey = productNameKey(productName);
  const candidates: MediaCandidate[] = [];
  const elements = container.querySelectorAll('img, picture source, video, video source');
  // Galleries that live beside the info column (thumbnail strips) but inside the same product
  // page wrapper. Only explicit gallery containers qualify here.
  const extras =
    scope === container
      ? []
      : scope
          .querySelectorAll('img, picture source, video, video source')
          .filter((el) => !elements.includes(el) && mediaDecision(el, scope) === 'include');
  for (const el of [...elements, ...extras]) {
    const tag = el.tagName.toLowerCase();
    const isVideo = tag === 'video' || parentEl(el)?.tagName?.toLowerCase() === 'video';
    const raw = tag === 'source' && !isVideo ? largestFromSrcset(el.getAttribute('srcset')) : null;
    const urlRaw = isVideo ? el.getAttribute('src') : (raw ?? imageUrlOf(el));
    const url = absolute(urlRaw ?? undefined, pageUrl);
    if (!url) continue;
    const decision = mediaDecision(el, scope);
    if (decision === 'exclude') continue;
    if (decision === null) {
      const alt = productNameKey(el.getAttribute('alt') ?? '');
      const altMatches = alt.length > 2 && (alt.includes(nameKey) || nameKey.includes(alt));
      if (!altMatches) continue;
    }
    candidates.push({
      kind: isVideo ? 'VIDEO' : 'IMAGE',
      url,
      hints: {
        width: numericAttr(el, 'width'),
        height: numericAttr(el, 'height'),
        alt: el.getAttribute('alt'),
      },
    });
  }
  return curateProductMedia(candidates, { base: pageUrl, cap });
}

const TITLE_SELECTOR = [
  '[itemprop="name"]',
  '[class*="product-title"]',
  '[class*="product_title"]',
  '[class*="product__title"]',
  '[class*="product-name"]',
  '[class*="product_name"]',
  '[class*="product-detail-title"]',
  '[class*="product-single__title"]',
  '[data-product-title]',
].join(', ');

function findTitle(root: HTMLElement): HTMLElement | null {
  const marked = root
    .querySelectorAll(TITLE_SELECTOR)
    .filter((el) => !isExcluded(el) && textOf(el).length >= 2 && textOf(el).length <= 200);
  const h1Marked = marked.find((el) => el.tagName.toLowerCase() === 'h1');
  if (h1Marked) return h1Marked;
  const anyH1Inside = marked.find((el) => el.querySelector('h1'));
  if (anyH1Inside) return anyH1Inside.querySelector('h1');
  const h1s = root.querySelectorAll('h1').filter((el) => !isExcluded(el) && textOf(el).length >= 2);
  if (h1s.length) return h1s[h1s.length - 1]!; // hero/category headings come first
  return marked[0] ?? null;
}

const CART_SIGNAL =
  /(add[\s_-]?to[\s_-]?(cart|bag|basket)|addtocart|buy[\s_-]?now|cart\/add|أضف إلى السلة|اضف الى السلة|أضف للسلة|إضافة إلى السلة|اشتر(?:ي|\u0650)? الآن|شراء الآن|اطلب الآن)/i;

function hasCartSignal(root: HTMLElement): boolean {
  for (const el of root.querySelectorAll('button, input[type="submit"], form, a')) {
    if (isExcluded(el)) continue;
    const blob = `${textOf(el)} ${el.getAttribute('name') ?? ''} ${el.getAttribute('action') ?? ''} ${tokensOf(el)} ${el.getAttribute('value') ?? ''}`;
    if (CART_SIGNAL.test(blob)) return true;
  }
  return false;
}

const COMPARE_TOKENS = /(compare|old|was|regular|original|before|strike|crossed|list-price)/i;

function findPrice(container: HTMLElement): {
  amount?: string;
  currency?: string;
  compareAt?: string;
} {
  const priceEls = container
    .querySelectorAll('[itemprop="price"], [class*="price"], [data-price], [id*="price"]')
    .filter((el) => !isExcluded(el, container));
  let amount: string | undefined;
  let currency: string | undefined;
  let compareAt: string | undefined;
  for (const el of priceEls) {
    const tokens = tokensOf(el);
    const isCompare =
      COMPARE_TOKENS.test(tokens) || ['del', 's', 'strike'].includes(el.tagName.toLowerCase());
    const contentAttr = el.getAttribute('content') ?? el.getAttribute('data-price');
    // Prefer the leaf that actually holds the number.
    const nested = el.querySelectorAll('del, s, strike, [class*="compare"], [class*="old"]');
    let text = contentAttr ?? textOf(el);
    if (!contentAttr && nested.length) {
      const struck = textOf(nested[0]);
      const strikeAmount = normalizePriceAmount(struck);
      if (strikeAmount && !compareAt) compareAt = strikeAmount;
      const clone = el.clone() as HTMLElement;
      for (const n of clone.querySelectorAll('del, s, strike, [class*="compare"], [class*="old"]'))
        n.remove();
      text = textOf(clone);
    }
    const parsed = parsePriceText(text);
    if (!parsed.amount) continue;
    if (isCompare) {
      if (!compareAt) compareAt = parsed.amount;
      continue;
    }
    if (!amount) {
      amount = parsed.amount;
      currency =
        normalizeCurrency(
          el.getAttribute('data-currency') ??
            container.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content') ??
            undefined,
        ) ?? parsed.currency;
    }
    if (amount && compareAt) break;
  }
  if (compareAt && amount && Number(compareAt) <= Number(amount)) compareAt = undefined;
  return { amount, currency, compareAt };
}

type SpecRole = 'sku' | 'brand' | 'category' | 'subcategory' | 'availability' | 'description';

const SPEC_LABELS: Array<[RegExp, SpecRole]> = [
  [
    /^(sku|product code|item (no|number|code)|model( number)?|رقم المنتج|رمز المنتج|كود المنتج|الرمز|الكود|رقم الموديل)(?=\s|[:：]|$)/i,
    'sku',
  ],
  [/^(brand|vendor|manufacturer|البراند|الماركة|العلامة التجارية|الشركة المصنعة)/i, 'brand'],
  [/^(sub-?category|القسم الفرعي|الفئة الفرعية|التصنيف الفرعي)/i, 'subcategory'],
  [/^(category|department|type|القسم الرئيسي|القسم|الفئة|التصنيف|النوع)/i, 'category'],
  [/^(availability|stock|status|التوفر|الحالة|المخزون)/i, 'availability'],
  [/^(description|details|الوصف|التفاصيل|عن المنتج)$/i, 'description'],
];

function specRole(label: string): SpecRole | null {
  for (const [pattern, role] of SPEC_LABELS) if (pattern.test(label.trim())) return role;
  return null;
}

function collectSpecs(container: HTMLElement): ProductAttribute[] {
  const out: ProductAttribute[] = [];
  const seen = new Set<string>();
  const push = (label: string, value: string) => {
    const l = cleanText(label.replace(/[:：]\s*$/, ''), 60);
    const v = cleanText(value, 300);
    if (!l || !v || l === v) return;
    const key = l.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label: l, value: v });
  };
  for (const dl of container.querySelectorAll('dl')) {
    if (isExcluded(dl, container)) continue;
    for (const dt of dl.querySelectorAll('dt')) {
      let next = dt.nextElementSibling as HTMLElement | null;
      while (next && next.tagName.toLowerCase() !== 'dd')
        next = next.nextElementSibling as HTMLElement | null;
      if (next) push(textOf(dt), textOf(next));
    }
  }
  for (const row of container.querySelectorAll('table tr')) {
    if (isExcluded(row, container)) continue;
    const cells = row.querySelectorAll('th, td');
    if (cells.length === 2) push(textOf(cells[0]), textOf(cells[1]));
  }
  for (const li of container.querySelectorAll('[class*="spec"] li, [class*="attribute"] li')) {
    if (isExcluded(li, container)) continue;
    const text = textOf(li);
    const idx = text.indexOf(':');
    if (idx > 0 && idx < 40) push(text.slice(0, idx), text.slice(idx + 1));
  }
  return out.slice(0, 30);
}

const DESCRIPTION_SELECTOR = [
  '[itemprop="description"]',
  '[class*="product-description"]',
  '[class*="product_description"]',
  '[class*="product__description"]',
  '[class*="short-description"]',
  '[class*="short_description"]',
  '[class*="product-details__text"]',
  '[class*="product-detail-description"]',
  '[class*="description"]',
  '#description',
  '#tab-description',
].join(', ');

function findDescription(container: HTMLElement, name: string): string | undefined {
  for (const el of container.querySelectorAll(DESCRIPTION_SELECTOR)) {
    if (isExcluded(el, container)) continue;
    const text = htmlToPlainText(el.innerHTML);
    if (text && text.length >= 20 && text !== name) return text;
  }
  return undefined;
}

/** Wrapper tokens of a single product page (outermost match wins). */
const PRODUCT_PAGE_TOKENS =
  /(product[-_]?(detail|page|single|main|template|view)|single[-_]product|(^|[\s_-])pdp([\s_-]|$))/i;

/** Outermost product-page wrapper around `container` (stops at main/body), else `container`. */
function productPageScope(container: HTMLElement): HTMLElement {
  let scope = container;
  let cur: HTMLElement | null = container;
  while (cur) {
    const tag = cur.tagName?.toLowerCase();
    if (tag === 'body' || tag === 'html' || tag === 'main') break;
    const tokens = tokensOf(cur);
    if (tokens && PRODUCT_PAGE_TOKENS.test(tokens) && !EXCLUDE_TOKENS.test(tokens)) scope = cur;
    cur = parentEl(cur);
  }
  return scope;
}

/** Smallest ancestor of the title that also contains the product's own gallery / price. */
function productContainer(title: HTMLElement, root: HTMLElement): HTMLElement {
  let cur: HTMLElement | null = parentEl(title);
  let fallback: HTMLElement = cur ?? root;
  while (cur) {
    const tag = cur.tagName?.toLowerCase();
    if (tag === 'body' || tag === 'html') break;
    const hasGallery = cur
      .querySelectorAll('img, video, picture source')
      .some((img) => mediaDecision(img, cur) === 'include');
    if (hasGallery) return cur;
    if (tag === 'main' || tag === 'article') fallback = cur;
    cur = parentEl(cur);
  }
  return root.querySelector('main') ?? fallback ?? root;
}

function breadcrumbCategory(root: HTMLElement, name: string): string | undefined {
  const crumbs = root.querySelectorAll(
    '[class*="breadcrumb"] a, [class*="breadcrumb"] span, nav[aria-label*="bread" i] a',
  );
  const labels = crumbs
    .map((el) => textOf(el))
    .filter((t) => t && t.length < 80 && t !== name && !/^[\\/>›→←»«|]+$/.test(t));
  const deduped = labels.filter((t, i) => labels.indexOf(t) === i);
  const withoutHome = deduped.filter((t) => !/^(home|الرئيسية|الصفحة الرئيسية)$/i.test(t));
  return withoutHome[withoutHome.length - 1];
}

function metaContent(root: HTMLElement, key: string): string | undefined {
  const needle = key.toLowerCase();
  for (const el of root.querySelectorAll('meta')) {
    const k = (el.getAttribute('property') || el.getAttribute('name') || '').toLowerCase();
    if (k === needle) {
      const content = el.getAttribute('content')?.trim();
      if (content) return content;
    }
  }
  return undefined;
}

function metaContents(root: HTMLElement, key: string): string[] {
  const needle = key.toLowerCase();
  return root
    .querySelectorAll('meta')
    .filter(
      (el) =>
        (el.getAttribute('property') || el.getAttribute('name') || '').toLowerCase() === needle,
    )
    .map((el) => el.getAttribute('content')?.trim() ?? '')
    .filter(Boolean);
}

/* ------------------------------------------------------------------------------------------ */
/* Microdata                                                                                   */
/* ------------------------------------------------------------------------------------------ */

function isProductItemtype(el: HTMLElement): boolean {
  return /schema\.org\/(product|individualproduct|productmodel|productgroup)$/i.test(
    (el.getAttribute('itemtype') ?? '').trim(),
  );
}

function nearestScope(el: HTMLElement): HTMLElement | null {
  let cur = parentEl(el);
  while (cur) {
    if (cur.hasAttribute('itemscope')) return cur;
    cur = parentEl(cur);
  }
  return null;
}

function itempropValue(el: HTMLElement): string | undefined {
  const tag = el.tagName.toLowerCase();
  const attr =
    el.getAttribute('content') ??
    (tag === 'img' || tag === 'source' || tag === 'video' ? imageUrlOf(el) : null) ??
    (tag === 'a' || tag === 'link' ? el.getAttribute('href') : null) ??
    (tag === 'meta' ? el.getAttribute('content') : null);
  return (attr ?? textOf(el)) || undefined;
}

function scopedProps(scope: HTMLElement): Map<string, HTMLElement[]> {
  const props = new Map<string, HTMLElement[]>();
  for (const el of scope.querySelectorAll('[itemprop]')) {
    if (nearestScope(el) !== scope) continue;
    for (const name of (el.getAttribute('itemprop') ?? '').split(/\s+/).filter(Boolean)) {
      const list = props.get(name) ?? [];
      list.push(el);
      props.set(name, list);
    }
  }
  return props;
}

export function productsFromMicrodata(
  root: HTMLElement,
  pageUrl: string,
  cap = DEFAULT_MAX_PRODUCT_MEDIA,
): ExtractedProduct[] {
  const out: ExtractedProduct[] = [];
  for (const scope of root.querySelectorAll('[itemscope][itemtype]')) {
    if (!isProductItemtype(scope)) continue;
    // Skip products nested inside another product (related items inside a detail page).
    let outer = nearestScope(scope);
    let nested = false;
    while (outer) {
      if (isProductItemtype(outer)) nested = true;
      outer = nearestScope(outer);
    }
    if (nested) continue;
    const props = scopedProps(scope);
    const first = (key: string) => {
      const el = props.get(key)?.[0];
      return el ? itempropValue(el) : undefined;
    };
    const name = cleanText(first('name'), 200);
    if (!name || isGenericLabel(name)) continue;
    let price = normalizePriceAmount(first('price'));
    let currency = normalizeCurrency(first('priceCurrency'));
    let availability = normalizeAvailability(first('availability'));
    const offerScope = props.get('offers')?.[0];
    if (offerScope) {
      const offerProps = scopedProps(offerScope);
      const get = (key: string) => {
        const el = offerProps.get(key)?.[0];
        return el ? itempropValue(el) : undefined;
      };
      price = price ?? normalizePriceAmount(get('price') ?? get('lowPrice'));
      currency = currency ?? normalizeCurrency(get('priceCurrency'));
      availability = availability ?? normalizeAvailability(get('availability'));
    }
    const media: MediaCandidate[] = [];
    for (const el of props.get('image') ?? []) {
      const url = absolute(itempropValue(el), pageUrl);
      if (url) media.push({ kind: 'IMAGE', url });
    }
    if (media.length < 2) media.push(...domMedia(scope, pageUrl, name, cap));
    out.push({
      kind: 'PRODUCT',
      name,
      description: htmlToPlainText(
        props.get('description')?.[0]?.innerHTML ?? first('description'),
      ),
      category: cleanText(first('category'), 120),
      skuPublic: cleanText(first('sku') ?? first('mpn') ?? first('productID'), 120),
      priceAmount: price,
      priceCurrency: currency,
      availability,
      media: curateProductMedia(media, { base: pageUrl, cap }),
      sourceUrl: absolute(first('url'), pageUrl),
      extractionSource: 'MICRODATA',
      confidence: SOURCE_CONFIDENCE.MICRODATA,
    });
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* OpenGraph product                                                                           */
/* ------------------------------------------------------------------------------------------ */

export function productFromOpenGraph(
  root: HTMLElement,
  pageUrl: string,
  cap = DEFAULT_MAX_PRODUCT_MEDIA,
): ExtractedProduct | null {
  const ogType = (metaContent(root, 'og:type') ?? '').toLowerCase();
  if (!ogType.includes('product')) return null;
  const name = cleanText(metaContent(root, 'og:title'), 200);
  if (!name || isGenericLabel(name)) return null;
  const images = metaContents(root, 'og:image')
    .concat(metaContents(root, 'og:image:secure_url'))
    .map((u) => absolute(u, pageUrl))
    .filter(Boolean) as string[];
  const videos = metaContents(root, 'og:video')
    .map((u) => absolute(u, pageUrl))
    .filter((u): u is string => Boolean(u) && guessMediaKind(u!) === 'VIDEO');
  return {
    kind: 'PRODUCT',
    name,
    description: htmlToPlainText(metaContent(root, 'og:description')),
    priceAmount: normalizePriceAmount(
      metaContent(root, 'product:price:amount') ?? metaContent(root, 'og:price:amount'),
    ),
    priceCurrency: normalizeCurrency(
      metaContent(root, 'product:price:currency') ?? metaContent(root, 'og:price:currency'),
    ),
    availability: normalizeAvailability(
      metaContent(root, 'product:availability') ?? metaContent(root, 'og:availability'),
    ),
    skuPublic: cleanText(metaContent(root, 'product:retailer_item_id'), 120),
    category: cleanText(metaContent(root, 'product:category'), 120),
    media: curateProductMedia(
      [
        ...images.map((url) => ({ kind: 'IMAGE' as const, url })),
        ...videos.map((url) => ({ kind: 'VIDEO' as const, url })),
      ],
      { base: pageUrl, cap },
    ),
    sourceUrl: absolute(metaContent(root, 'og:url'), pageUrl) ?? pageUrl,
    extractionSource: 'OPEN_GRAPH',
    confidence: SOURCE_CONFIDENCE.OPEN_GRAPH,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Rendered detail page (no structured data)                                                   */
/* ------------------------------------------------------------------------------------------ */

export function productFromDetailDom(
  root: HTMLElement,
  pageUrl: string,
  cap = DEFAULT_MAX_PRODUCT_MEDIA,
): ExtractedProduct | null {
  const body = root.querySelector('body') ?? root;
  const title = findTitle(body);
  if (!title) return null;
  const name = cleanText(textOf(title), 200);
  if (!name || isGenericLabel(name)) return null;
  const detailUrl = isProductDetailUrl(pageUrl);
  const container = productContainer(title, body);
  const price = findPrice(container);
  const cart = hasCartSignal(body);
  const titleMarked = title.matches?.(TITLE_SELECTOR) ?? false;
  // A product page needs commerce evidence: a detail URL plus price or cart, or a marked
  // product title with both. Listing pages, category pages, and home sections never qualify.
  if (!((detailUrl && (price.amount || cart)) || (titleMarked && price.amount && cart))) {
    return null;
  }

  const specs = collectSpecs(container);
  let sku: string | undefined;
  let brand: string | undefined;
  let category: string | undefined;
  let subcategory: string | undefined;
  let availabilityText: string | undefined;
  let specDescription: string | undefined;
  const attributes: ProductAttribute[] = [];
  for (const spec of specs) {
    const role = specRole(spec.label);
    if (role === 'sku' && !sku) sku = spec.value;
    else if (role === 'brand' && !brand) brand = spec.value;
    else if (role === 'category' && !category) category = spec.value;
    else if (role === 'subcategory' && !subcategory) subcategory = spec.value;
    else if (role === 'availability' && !availabilityText) availabilityText = spec.value;
    else if (role === 'description' && !specDescription) specDescription = spec.value;
    else attributes.push(spec);
  }
  if (brand) attributes.unshift({ label: 'brand', value: brand });

  const availabilityEl = container
    .querySelectorAll('[class*="availability"], [class*="stock"], [itemprop="availability"]')
    .find((el) => !isExcluded(el, container));
  const availability =
    normalizeAvailability(availabilityEl?.getAttribute('content') ?? textOf(availabilityEl)) ??
    normalizeAvailability(availabilityText);

  const ogType = (metaContent(root, 'og:type') ?? '').toLowerCase();
  const metaDescription = ogType.includes('product')
    ? (metaContent(root, 'og:description') ?? metaContent(root, 'description'))
    : undefined;
  let media = domMedia(container, pageUrl, name, cap, productPageScope(container));
  if (!media.length && ogType.includes('product')) {
    const og = absolute(metaContent(root, 'og:image'), pageUrl);
    if (og) media = curateProductMedia([{ kind: 'IMAGE', url: og }], { base: pageUrl, cap });
  }
  const categoryLabel =
    subcategory && category && subcategory !== category
      ? `${category} › ${subcategory}`
      : (subcategory ?? category ?? breadcrumbCategory(body, name));

  return {
    kind: 'PRODUCT',
    name,
    description:
      findDescription(container, name) ??
      htmlToPlainText(specDescription) ??
      htmlToPlainText(metaDescription),
    category: cleanText(categoryLabel, 160),
    skuPublic: cleanText(sku, 120),
    priceAmount: price.amount,
    priceCurrency: price.currency,
    compareAtPrice: price.compareAt,
    availability,
    media,
    sourceUrl: pageUrl,
    attributes: attributes.slice(0, 20),
    extractionSource: 'DOM_DETAIL',
    confidence: SOURCE_CONFIDENCE.DOM_DETAIL,
  };
}

function serviceFromPage(root: HTMLElement, pageUrl: string): ExtractedProduct | null {
  if (!isServicePath(pageUrl)) return null;
  const h1 = root.querySelectorAll('h1').find((el) => !isExcluded(el));
  const name = cleanText(textOf(h1), 200);
  if (!name || isGenericLabel(name)) return null;
  return {
    kind: 'SERVICE',
    name,
    description: htmlToPlainText(metaContent(root, 'description')),
    sourceUrl: pageUrl,
    extractionSource: 'DOM_DETAIL',
    confidence: 0.5,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Merge + page entry point                                                                    */
/* ------------------------------------------------------------------------------------------ */

function sameProduct(a: ExtractedProduct, b: ExtractedProduct): boolean {
  if (a.kind !== b.kind) return false;
  if (a.skuPublic && b.skuPublic && a.skuPublic.toLowerCase() === b.skuPublic.toLowerCase())
    return true;
  if (a.sourceUrl && b.sourceUrl && a.sourceUrl === b.sourceUrl) return true;
  return productNameKey(a.name) === productNameKey(b.name);
}

/**
 * Field-level merge: the higher-confidence record wins each field it has; the other fills gaps.
 * Media comes from one record only (never a union across sources) so pictures cannot leak
 * between products; the richer list wins when both describe the same page.
 */
export function mergeProductRecords(
  primary: ExtractedProduct,
  secondary: ExtractedProduct,
): ExtractedProduct {
  const [hi, lo] =
    (secondary.confidence ?? 0) > (primary.confidence ?? 0)
      ? [secondary, primary]
      : [primary, secondary];
  const pick = <K extends keyof ExtractedProduct>(key: K) => hi[key] ?? lo[key];
  const hiMedia = hi.media ?? [];
  const loMedia = lo.media ?? [];
  const samePage = !hi.sourceUrl || !lo.sourceUrl || hi.sourceUrl === lo.sourceUrl;
  const media =
    hiMedia.length === 0 || (samePage && loMedia.length > hiMedia.length) ? loMedia : hiMedia;
  const attributes = [...(hi.attributes ?? [])];
  for (const attr of lo.attributes ?? []) {
    if (!attributes.some((a) => a.label.toLowerCase() === attr.label.toLowerCase()))
      attributes.push(attr);
  }
  return {
    kind: hi.kind,
    name: hi.name,
    description:
      (hi.description?.length ?? 0) >= (lo.description?.length ?? 0) * 0.5
        ? (hi.description ?? lo.description)
        : lo.description,
    category: pick('category'),
    skuPublic: pick('skuPublic'),
    priceAmount: pick('priceAmount'),
    priceCurrency: hi.priceAmount ? (hi.priceCurrency ?? lo.priceCurrency) : pick('priceCurrency'),
    compareAtPrice: pick('compareAtPrice'),
    availability: pick('availability'),
    media,
    sourceUrl: pick('sourceUrl'),
    platformId: pick('platformId'),
    variantCount: pick('variantCount'),
    attributes: attributes.slice(0, 20),
    extractionSource: hi.extractionSource,
    confidence: Math.min(1, Math.max(hi.confidence ?? 0, lo.confidence ?? 0) + 0.02),
  };
}

export function detectPageProducts(input: {
  root: HTMLElement;
  pageUrl: string;
  jsonLdNodes: Record<string, unknown>[];
  mediaCap?: number;
}): PageProductDetection {
  const { root, pageUrl } = input;
  const cap = input.mediaCap ?? DEFAULT_MAX_PRODUCT_MEDIA;
  const structured: ExtractedProduct[] = [
    ...productsFromJsonLd(input.jsonLdNodes, pageUrl, cap),
    ...productsFromMicrodata(root, pageUrl, cap),
  ];
  const og = productFromOpenGraph(root, pageUrl, cap);
  if (og) structured.push(og);

  const merged: ExtractedProduct[] = [];
  for (const product of structured) {
    const index = merged.findIndex((m) => sameProduct(m, product));
    if (index >= 0) merged[index] = mergeProductRecords(merged[index]!, product);
    else merged.push(product);
  }

  const productCount = merged.filter((p) => p.kind === 'PRODUCT').length;
  // On a single-product page, enrich structured data with the rendered gallery/specs.
  if (productCount <= 1) {
    const dom = productFromDetailDom(root, pageUrl, cap);
    if (dom) {
      const index = merged.findIndex((m) => m.kind === 'PRODUCT');
      if (index >= 0) {
        const base = merged[index]!;
        merged[index] = mergeProductRecords(base, { ...dom, name: base.name });
      } else {
        merged.push(dom);
      }
    }
  }

  const service = serviceFromPage(root, pageUrl);
  if (service && !merged.some((m) => sameProduct(m, service))) merged.push(service);

  // A product found on its own page belongs to that URL.
  const finalProducts = merged.map((p) =>
    p.kind === 'PRODUCT' && merged.filter((m) => m.kind === 'PRODUCT').length === 1
      ? { ...p, sourceUrl: p.sourceUrl ?? pageUrl }
      : p,
  );

  const products = finalProducts.filter((p) => p.kind === 'PRODUCT');
  let pageKind: PageProductKind = 'OTHER';
  if (products.length === 1) pageKind = 'PRODUCT_DETAIL';
  else if (products.length > 1 || isListingUrl(pageUrl)) pageKind = 'LISTING';
  else if (finalProducts.some((p) => p.kind === 'SERVICE')) pageKind = 'SERVICE';
  return { products: finalProducts, pageKind };
}
