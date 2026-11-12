import { parse as parseHtml, type HTMLElement } from 'node-html-parser';

export type ExtractionMethod = 'HTML_META' | 'JSON_LD' | 'OG' | 'HEURISTIC' | 'USER' | 'AI';

export type ExtractedField = {
  fieldKey: string;
  value: unknown;
  isUnknown: boolean;
  extractionMethod: ExtractionMethod;
  confidence?: number;
};

export type ExtractedProduct = {
  kind: 'PRODUCT' | 'SERVICE';
  name: string;
  description?: string;
  category?: string;
  skuPublic?: string;
  priceAmount?: string;
  priceCurrency?: string;
  availability?: string;
};

export type ExtractedLink = {
  href: string;
  rel: string;
};

const EXCERPT_MAX = 2000;

const SOCIAL_NETWORKS: Array<{ network: string; hosts: string[] }> = [
  { network: 'instagram', hosts: ['instagram.com', 'instagr.am'] },
  { network: 'facebook', hosts: ['facebook.com', 'fb.com', 'fb.me', 'm.facebook.com'] },
  { network: 'x', hosts: ['x.com', 'twitter.com', 'mobile.twitter.com'] },
  { network: 'tiktok', hosts: ['tiktok.com'] },
  { network: 'linkedin', hosts: ['linkedin.com', 'lnkd.in'] },
  { network: 'youtube', hosts: ['youtube.com', 'youtu.be', 'm.youtube.com'] },
  { network: 'snapchat', hosts: ['snapchat.com', 'snap.com'] },
  { network: 'whatsapp', hosts: ['whatsapp.com', 'wa.me', 'api.whatsapp.com'] },
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+|00)[1-9][\d\s().-]{7,18}\d/g;

export function boundExcerpt(text: string, max = EXCERPT_MAX): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

function metaContent(root: HTMLElement, name: string): string | null {
  const needle = name.toLowerCase();
  for (const el of root.querySelectorAll('meta')) {
    const key = (el.getAttribute('name') || el.getAttribute('property') || '').toLowerCase();
    if (key === needle) {
      const content = el.getAttribute('content')?.trim();
      if (content) return content;
    }
  }
  return null;
}

function collectJsonLdNodes(root: HTMLElement): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    results.push(record);
    if (record['@graph']) visit(record['@graph']);
  };
  for (const script of root.querySelectorAll('script')) {
    const type = (script.getAttribute('type') || '').toLowerCase();
    if (!type.includes('ld+json')) continue;
    try {
      visit(JSON.parse(script.text || script.innerHTML || ''));
    } catch {
      // skip invalid JSON-LD
    }
  }
  return results;
}

function typeList(node: Record<string, unknown>): string {
  const raw = node['@type'];
  if (Array.isArray(raw)) return raw.map((item) => String(item).toLowerCase()).join(' ');
  return String(raw ?? '').toLowerCase();
}

function classifyPage(url: string, root: HTMLElement): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path === '/' || path === '') return 'HOME';
  if (path.includes('product') || path.includes('shop') || path.includes('catalog'))
    return 'PRODUCT';
  if (path.includes('service') || path.includes('solution') || path.includes('pricing'))
    return 'SERVICE';
  if (path.includes('about')) return 'ABOUT';
  if (path.includes('contact')) return 'CONTACT';
  if (path.includes('faq')) return 'FAQ';
  if (path.includes('legal') || path.includes('privacy') || path.includes('terms')) return 'LEGAL';
  const ogType = metaContent(root, 'og:type');
  if (ogType?.includes('product')) return 'PRODUCT';
  return 'OTHER';
}

function parseRobotsDirectives(root: HTMLElement): { noindex: boolean; nofollow: boolean } {
  const content = (
    metaContent(root, 'robots') ||
    metaContent(root, 'googlebot') ||
    ''
  ).toLowerCase();
  return {
    noindex: content.includes('noindex'),
    nofollow: content.includes('nofollow'),
  };
}

function hostMatches(hostname: string, suffix: string): boolean {
  const host = hostname.toLowerCase();
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function classifySocialUrl(raw: string): { network: string; url: string } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    for (const entry of SOCIAL_NETWORKS) {
      if (entry.hosts.some((host) => hostMatches(url.hostname, host))) {
        return { network: entry.network, url: url.toString() };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function jsonLdString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'url' in value) {
    return jsonLdString((value as { url?: unknown }).url);
  }
  return null;
}

function productFromJsonLdNode(
  node: Record<string, unknown>,
  kindHint?: 'PRODUCT' | 'SERVICE',
): ExtractedProduct | null {
  const type = typeList(node);
  const isService =
    kindHint === 'SERVICE' ||
    type.includes('service') ||
    (type.includes('professional') && type.includes('service'));
  const isProduct =
    kindHint === 'PRODUCT' ||
    type.includes('product') ||
    type.includes('individualproduct');
  if (!isProduct && !isService) return null;
  const name = String(node.name ?? node.title ?? '').trim();
  if (!name || name === 'Unknown') return null;
  const offersRaw = node.offers;
  const offers = Array.isArray(offersRaw)
    ? (offersRaw[0] as Record<string, unknown> | undefined)
    : (offersRaw as Record<string, unknown> | undefined);
  return {
    kind: isService ? 'SERVICE' : 'PRODUCT',
    name,
    description: node.description ? String(node.description).slice(0, 2000) : undefined,
    category: node.category ? String(node.category) : undefined,
    skuPublic: node.sku ? String(node.sku) : node.gtin13 ? String(node.gtin13) : undefined,
    priceAmount: offers?.price ? String(offers.price) : undefined,
    priceCurrency: offers?.priceCurrency ? String(offers.priceCurrency) : undefined,
    availability: offers?.availability ? String(offers.availability) : undefined,
  };
}

function collectProductsFromJsonLd(nodes: Record<string, unknown>[]): ExtractedProduct[] {
  const out: ExtractedProduct[] = [];
  const seen = new Set<string>();
  const push = (product: ExtractedProduct | null) => {
    if (!product) return;
    const key = `${product.kind}:${product.name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(product);
  };
  for (const node of nodes) {
    push(productFromJsonLdNode(node));
    const type = typeList(node);
    if (type.includes('itemlist')) {
      const elements = node.itemListElement;
      const list = Array.isArray(elements) ? elements : elements ? [elements] : [];
      for (const el of list) {
        if (typeof el !== 'object' || !el) continue;
        const record = el as Record<string, unknown>;
        const nested = record.item;
        if (nested && typeof nested === 'object') {
          push(productFromJsonLdNode(nested as Record<string, unknown>));
        }
        const name = jsonLdString(record.name);
        if (name) {
          const elType = typeList(record);
          push({
            kind: elType.includes('service') ? 'SERVICE' : 'PRODUCT',
            name,
            description: record.description ? String(record.description) : undefined,
          });
        }
      }
    }
    if (type.includes('offer')) {
      const item = node.itemOffered;
      if (item && typeof item === 'object') push(productFromJsonLdNode(item as Record<string, unknown>));
    }
    if (type.includes('offerCatalog') || type.includes('productgroup')) {
      const items = node.hasVariant ?? node.hasPart ?? node.itemListElement;
      const list = Array.isArray(items) ? items : items ? [items] : [];
      for (const item of list) {
        if (item && typeof item === 'object') push(productFromJsonLdNode(item as Record<string, unknown>));
      }
    }
  }
  return out;
}

function collectHeuristicProducts(root: HTMLElement, pageUrl: string): ExtractedProduct[] {
  const out: ExtractedProduct[] = [];
  const seen = new Set<string>();
  const push = (kind: 'PRODUCT' | 'SERVICE', name: string, description?: string) => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 200) return;
    const key = `${kind}:${trimmed.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, name: trimmed, description: description?.slice(0, 500) });
  };
  for (const el of root.querySelectorAll('[itemtype]')) {
    const itemtype = (el.getAttribute('itemtype') || '').toLowerCase();
    const isProduct = itemtype.includes('product');
    const isService = itemtype.includes('service');
    if (!isProduct && !isService) continue;
    const name =
      el.querySelector('[itemprop="name"]')?.text?.trim() ||
      el.querySelector('h1,h2,h3')?.text?.trim() ||
      '';
    const description = el.querySelector('[itemprop="description"]')?.text?.trim();
    push(isService ? 'SERVICE' : 'PRODUCT', name, description);
  }
  for (const el of root.querySelectorAll('[class*="product"], [class*="service"], [data-product]')) {
    const heading = el.querySelector('h1,h2,h3,h4,a')?.text?.trim();
    if (!heading) continue;
    const cls = (el.getAttribute('class') || '').toLowerCase();
    const kind = cls.includes('service') ? 'SERVICE' : 'PRODUCT';
    push(kind, heading);
  }
  try {
    const path = new URL(pageUrl).pathname.toLowerCase();
    if (path.includes('service') || path.includes('solution')) {
      const h1 = root.querySelector('h1')?.text?.trim();
      if (h1) push('SERVICE', h1, root.querySelector('meta[name="description"]')?.getAttribute('content') ?? undefined);
    }
  } catch {
    // ignore
  }
  return out;
}

function collectAddress(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) return collectAddress(value[0]);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts = [
      record.streetAddress,
      record.addressLocality,
      record.addressRegion,
      record.postalCode,
      record.addressCountry,
    ]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    return parts.join(', ') || jsonLdString(record.name);
  }
  return null;
}

export function extractFromHtml(
  url: string,
  html: string,
): {
  fields: ExtractedField[];
  products: ExtractedProduct[];
  pageTitle: string | null;
  classification: string;
  excerpt: string;
  links: ExtractedLink[];
  canonicalUrl: string | null;
  noindex: boolean;
  nofollow: boolean;
} {
  const root = parseHtml(html);
  const pageTitle =
    root.querySelector('title')?.text?.trim() || metaContent(root, 'og:title') || null;
  const description = metaContent(root, 'description') ?? metaContent(root, 'og:description');
  const siteName = metaContent(root, 'og:site_name');
  const robots = parseRobotsDirectives(root);
  const canonicalHref = root.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim();
  let canonicalUrl: string | null = null;
  if (canonicalHref) {
    try {
      canonicalUrl = new URL(canonicalHref, url).toString();
    } catch {
      canonicalUrl = null;
    }
  }

  const fields: ExtractedField[] = [];
  if (siteName || pageTitle) {
    fields.push({
      fieldKey: 'brand.name',
      value: siteName ?? pageTitle,
      isUnknown: false,
      extractionMethod: siteName ? 'OG' : 'HTML_META',
      confidence: 0.9,
    });
  } else {
    fields.push({
      fieldKey: 'brand.name',
      value: null,
      isUnknown: true,
      extractionMethod: 'HEURISTIC',
    });
  }

  fields.push({
    fieldKey: 'brand.source_url',
    value: url,
    isUnknown: false,
    extractionMethod: 'HEURISTIC',
    confidence: 1,
  });

  fields.push({
    fieldKey: 'brand.description',
    value: description,
    isUnknown: !description,
    extractionMethod: description
      ? metaContent(root, 'og:description')
        ? 'OG'
        : 'HTML_META'
      : 'HEURISTIC',
    confidence: description ? 0.8 : undefined,
  });

  const products: ExtractedProduct[] = [];
  const social: Array<{ network: string; url: string }> = [];
  const emails: string[] = [];
  const phones: string[] = [];
  const addresses: string[] = [];
  const languages = uniqueStrings([
    root.querySelector('html')?.getAttribute('lang'),
    ...root
      .querySelectorAll('link[rel="alternate"]')
      .map((el) => el.getAttribute('hreflang'))
      .filter((value) => value && value.toLowerCase() !== 'x-default'),
  ]);
  const logos: string[] = [];
  const colors: string[] = [];

  const themeColor = metaContent(root, 'theme-color');
  const tileColor = metaContent(root, 'msapplication-TileColor');
  if (themeColor) colors.push(themeColor);
  if (tileColor) colors.push(tileColor);

  const ogImage = metaContent(root, 'og:image');
  const favicon =
    root.querySelector('link[rel="icon"]')?.getAttribute('href') ||
    root.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
    root.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
  if (ogImage) {
    try {
      logos.push(new URL(ogImage, url).toString());
    } catch {
      // ignore
    }
  }
  if (favicon) {
    try {
      logos.push(new URL(favicon, url).toString());
    } catch {
      // ignore
    }
  }

  const jsonLdNodes = collectJsonLdNodes(root);
  products.push(...collectProductsFromJsonLd(jsonLdNodes));
  products.push(...collectHeuristicProducts(root, url));

  for (const node of jsonLdNodes) {
    const type = typeList(node);
    if (type.includes('organization') || type.includes('localbusiness')) {
      if (!siteName && node.name) {
        fields.push({
          fieldKey: 'brand.name',
          value: String(node.name),
          isUnknown: false,
          extractionMethod: 'JSON_LD',
          confidence: 0.95,
        });
      }
      const sameAs = node.sameAs;
      const sameAsList = Array.isArray(sameAs) ? sameAs : sameAs ? [sameAs] : [];
      for (const item of sameAsList) {
        const classified = typeof item === 'string' ? classifySocialUrl(item) : null;
        if (classified) social.push(classified);
      }
      const email = jsonLdString(node.email);
      const telephone = jsonLdString(node.telephone);
      if (email) emails.push(email);
      if (telephone) phones.push(telephone);
      const address = collectAddress(node.address);
      if (address) addresses.push(address);
      const logo = jsonLdString(node.logo);
      if (logo) {
        try {
          logos.push(new URL(logo, url).toString());
        } catch {
          // ignore
        }
      }
    }
  }

  const links: ExtractedLink[] = [];
  for (const el of root.querySelectorAll('a[href], area[href]')) {
    const href = el.getAttribute('href')?.trim();
    if (!href) continue;
    const rel = (el.getAttribute('rel') || '').toLowerCase();
    links.push({ href, rel });
    try {
      const absolute = new URL(href, url);
      if (absolute.protocol === 'mailto:') {
        emails.push(decodeURIComponent(absolute.pathname));
      } else if (absolute.protocol === 'tel:') {
        phones.push(decodeURIComponent(absolute.pathname));
      } else {
        const classified = classifySocialUrl(absolute.toString());
        if (classified) social.push(classified);
      }
    } catch {
      // skip bad hrefs
    }
  }

  for (const el of root.querySelectorAll('script, style, noscript')) {
    el.remove();
  }
  const bodyText = root.text.replace(/\s+/g, ' ').trim();
  for (const match of bodyText.match(EMAIL_RE) ?? []) emails.push(match);
  for (const match of bodyText.match(PHONE_RE) ?? [])
    phones.push(match.replace(/\s+/g, ' ').trim());

  const socialProfiles = uniqueStrings(social.map((item) => `${item.network}|${item.url}`)).map(
    (entry) => {
      const [network, profileUrl] = entry.split('|');
      return { network, url: profileUrl };
    },
  );
  if (socialProfiles.length > 0) {
    fields.push({
      fieldKey: 'brand.social',
      value: { profiles: socialProfiles },
      isUnknown: false,
      extractionMethod: 'HEURISTIC',
      confidence: 0.85,
    });
  }

  const contact = {
    emails: uniqueStrings(emails).slice(0, 10),
    phones: uniqueStrings(phones).slice(0, 10),
    addresses: uniqueStrings(addresses).slice(0, 5),
  };
  if (contact.emails.length || contact.phones.length || contact.addresses.length) {
    fields.push({
      fieldKey: 'brand.contact',
      value: contact,
      isUnknown: false,
      extractionMethod: 'HEURISTIC',
      confidence: 0.8,
    });
  }

  if (languages.length > 0) {
    fields.push({
      fieldKey: 'brand.languages',
      value: languages,
      isUnknown: false,
      extractionMethod: 'HTML_META',
      confidence: 0.9,
    });
  }

  const uniqueLogos = uniqueStrings(logos).slice(0, 5);
  if (uniqueLogos.length > 0) {
    fields.push({
      fieldKey: 'brand.logo',
      value: {
        og_image: ogImage ? new URL(ogImage, url).toString() : null,
        favicon: favicon ? new URL(favicon, url).toString() : null,
        urls: uniqueLogos,
      },
      isUnknown: false,
      extractionMethod: 'HTML_META',
      confidence: 0.75,
    });
  }

  const uniqueColors = uniqueStrings(colors);
  if (uniqueColors.length > 0) {
    fields.push({
      fieldKey: 'brand.colors',
      value: { theme: uniqueColors },
      isUnknown: false,
      extractionMethod: 'HTML_META',
      confidence: 0.7,
    });
  }

  return {
    fields,
    products,
    pageTitle,
    classification: classifyPage(url, root),
    excerpt: boundExcerpt(bodyText.slice(0, 500) || pageTitle || url),
    links,
    canonicalUrl,
    noindex: robots.noindex,
    nofollow: robots.nofollow,
  };
}
