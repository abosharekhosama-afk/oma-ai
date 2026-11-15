import { parse as parseHtml } from 'node-html-parser';

/** Where a product record came from — strongest first. */
export type ProductExtractionSource =
  'PLATFORM_API' | 'JSON_LD' | 'MICRODATA' | 'OPEN_GRAPH' | 'DOM_DETAIL';

/** Default confidence per extraction source (0..1). */
export const SOURCE_CONFIDENCE: Record<ProductExtractionSource, number> = {
  PLATFORM_API: 0.97,
  JSON_LD: 0.92,
  MICRODATA: 0.85,
  OPEN_GRAPH: 0.75,
  DOM_DETAIL: 0.7,
};

export type ProductAttribute = { label: string; value: string };

export type ExtractedProductMedia = {
  kind: 'IMAGE' | 'VIDEO';
  url: string;
};

export type ExtractedProduct = {
  kind: 'PRODUCT' | 'SERVICE';
  name: string;
  description?: string;
  category?: string;
  skuPublic?: string;
  priceAmount?: string;
  priceCurrency?: string;
  /** Regular price when the product is on sale (compare-at / original price). */
  compareAtPrice?: string;
  availability?: string;
  media?: ExtractedProductMedia[];
  /** The product's own detail page (absolute URL), when known. */
  sourceUrl?: string;
  /** Stable platform identifier, e.g. `shopify:123`, `woocommerce:45`. */
  platformId?: string;
  variantCount?: number;
  /** Other facts the store publishes (age, material, brand …). */
  attributes?: ProductAttribute[];
  extractionSource?: ProductExtractionSource;
  /** 0..1 — how sure we are this is a real product with correct fields. */
  confidence?: number;
};

const ARABIC_INDIC = /[\u0660-\u0669\u06F0-\u06F9]/g;

function westernDigits(input: string): string {
  return input.replace(ARABIC_INDIC, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

const DESCRIPTION_MAX = 4000;

/** Converts a product description (HTML or text) to clean plain text; Arabic is preserved. */
export function htmlToPlainText(input: unknown, max = DESCRIPTION_MAX): string | undefined {
  if (typeof input !== 'string') return undefined;
  const raw = input.trim();
  if (!raw) return undefined;
  let text = raw;
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    const withBreaks = raw
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\/\s*(p|div|li|h[1-6]|tr|section|article|ul|ol)\s*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '• ');
    const root = parseHtml(withBreaks);
    for (const el of root.querySelectorAll('script, style, noscript, template')) el.remove();
    text = root.text;
  }
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Normalises a price to a plain decimal string ("1299.5"); returns undefined for non-prices. */
export function normalizePriceAmount(input: unknown): string | undefined {
  if (input == null) return undefined;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return undefined;
    return String(Math.round(input * 100) / 100);
  }
  if (typeof input !== 'string') return undefined;
  let s = westernDigits(input)
    .replace(/[\u066B]/g, '.')
    .replace(/[\u066C\s]/g, '');
  const match = s.match(/\d[\d.,]*/);
  if (!match) return undefined;
  s = match[0];
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // The later separator is the decimal one.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s =
      decimals === 3 || (s.match(/,/g)?.length ?? 0) > 1
        ? s.replace(/,/g, '')
        : s.replace(',', '.');
  } else if ((s.match(/\./g)?.length ?? 0) > 1) {
    s = s.replace(/\./g, '');
  }
  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return String(Math.round(value * 100) / 100);
}

/** Integer minor units (e.g. WooCommerce "12999" with minor unit 2) to a decimal string. */
export function minorUnitsToAmount(raw: unknown, minorUnit: unknown): string | undefined {
  const value = Number(raw);
  const unit = Number(minorUnit ?? 2);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  const divisor = 10 ** (Number.isFinite(unit) && unit >= 0 && unit <= 4 ? unit : 2);
  return normalizePriceAmount(value / divisor);
}

const CURRENCY_SYMBOLS: Array<[RegExp, string]> = [
  [/₪|ش\.ج|شيكل|\bILS\b|\bNIS\b/i, 'ILS'],
  [/ر\.?\s?س|ريال سعودي|\bSAR\b/i, 'SAR'],
  [/د\.?\s?إ|درهم|\bAED\b/i, 'AED'],
  [/د\.?\s?أ|دينار أردني|\bJOD\b/i, 'JOD'],
  [/د\.?\s?ك|دينار كويتي|\bKWD\b/i, 'KWD'],
  [/ر\.?\s?ق|ريال قطري|\bQAR\b/i, 'QAR'],
  [/ر\.?\s?ع|ريال عماني|\bOMR\b/i, 'OMR'],
  [/د\.?\s?ب|دينار بحريني|\bBHD\b/i, 'BHD'],
  [/ج\.?\s?م|جنيه|\bEGP\b/i, 'EGP'],
  [/€|\bEUR\b/i, 'EUR'],
  [/£|\bGBP\b/i, 'GBP'],
  [/₺|\bTRY\b/i, 'TRY'],
  [/\$|\bUSD\b/i, 'USD'],
];

export function detectCurrency(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  for (const [pattern, code] of CURRENCY_SYMBOLS) {
    if (pattern.test(text)) return code;
  }
  return undefined;
}

export function normalizeCurrency(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return detectCurrency(trimmed);
}

export function parsePriceText(text: string | null | undefined): {
  amount?: string;
  currency?: string;
} {
  if (!text) return {};
  return { amount: normalizePriceAmount(text), currency: detectCurrency(text) };
}

const AVAILABILITY_TEXT: Array<[RegExp, string]> = [
  [
    /out\s*of\s*stock|sold\s*out|unavailable|غير متوفر|غير متاح|نفد|نفذت|نفذ|نفدت|منتهي/i,
    'OutOfStock',
  ],
  [/pre-?\s?order|حجز مسبق|طلب مسبق/i, 'PreOrder'],
  [/back-?\s?order/i, 'BackOrder'],
  [/limited|كمية محدودة|محدود/i, 'LimitedAvailability'],
  [/discontinued|متوقف/i, 'Discontinued'],
  [/in\s*stock|available|متوفر|متاح|موجود/i, 'InStock'],
];

/** Maps schema.org URLs, platform flags, and EN/AR shop text to schema.org short names. */
export function normalizeAvailability(raw: unknown): string | undefined {
  if (raw === true) return 'InStock';
  if (raw === false) return 'OutOfStock';
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const tail = trimmed.split(/[/#]/).pop() ?? trimmed;
  const compact = tail.toLowerCase().replace(/[^a-z]/g, '');
  const known: Record<string, string> = {
    instock: 'InStock',
    outofstock: 'OutOfStock',
    soldout: 'OutOfStock',
    preorder: 'PreOrder',
    presale: 'PreOrder',
    backorder: 'BackOrder',
    onbackorder: 'BackOrder',
    limitedavailability: 'LimitedAvailability',
    discontinued: 'Discontinued',
    onlineonly: 'OnlineOnly',
    instoreonly: 'InStoreOnly',
  };
  if (known[compact]) return known[compact];
  for (const [pattern, value] of AVAILABILITY_TEXT) {
    if (pattern.test(trimmed)) return value;
  }
  return undefined;
}

export function cleanText(value: unknown, max = 300): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return text.length > max ? text.slice(0, max) : text;
}

/** Product name normalisation for identity comparison (case/space/punctuation-insensitive). */
export function productNameKey(name: string): string {
  return westernDigits(name)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u064B-\u0652\u0640]/g, '') // Arabic diacritics + tatweel
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
