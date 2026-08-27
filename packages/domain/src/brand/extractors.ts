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

const EXCERPT_MAX = 2000;

export function boundExcerpt(text: string, max = EXCERPT_MAX): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1]?.trim() ?? null;
}

function extractJsonLd(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1];
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') results.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === 'object') {
        results.push(parsed as Record<string, unknown>);
      }
    } catch {
      // skip invalid JSON-LD
    }
  }
  return results;
}

function classifyPage(url: string, html: string): string {
  const path = new URL(url).pathname.toLowerCase();
  if (path === '/' || path === '') return 'HOME';
  if (path.includes('product')) return 'PRODUCT';
  if (path.includes('about')) return 'ABOUT';
  if (path.includes('contact')) return 'CONTACT';
  if (path.includes('faq')) return 'FAQ';
  if (path.includes('legal') || path.includes('privacy') || path.includes('terms')) return 'LEGAL';
  const ogType = extractMeta(html, 'og:type');
  if (ogType?.includes('product')) return 'PRODUCT';
  return 'OTHER';
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
} {
  const pageTitle = extractTitle(html) ?? extractMeta(html, 'og:title');
  const description = extractMeta(html, 'description') ?? extractMeta(html, 'og:description');
  const siteName = extractMeta(html, 'og:site_name');

  const fields: ExtractedField[] = [];
  if (siteName || pageTitle) {
    fields.push({
      fieldKey: 'brand.name',
      value: siteName ?? pageTitle,
      isUnknown: false,
      extractionMethod: extractMeta(html, 'og:site_name') ? 'OG' : 'HTML_META',
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
      ? extractMeta(html, 'og:description')
        ? 'OG'
        : 'HTML_META'
      : 'HEURISTIC',
    confidence: description ? 0.8 : undefined,
  });

  const products: ExtractedProduct[] = [];
  for (const node of extractJsonLd(html)) {
    const type = String(node['@type'] ?? '').toLowerCase();
    if (type.includes('product') || type.includes('service')) {
      const offers = node.offers as Record<string, unknown> | undefined;
      products.push({
        kind: type.includes('service') ? 'SERVICE' : 'PRODUCT',
        name: String(node.name ?? 'Unknown'),
        description: node.description ? String(node.description) : undefined,
        category: node.category ? String(node.category) : undefined,
        skuPublic: node.sku ? String(node.sku) : undefined,
        priceAmount: offers?.price ? String(offers.price) : undefined,
        priceCurrency: offers?.priceCurrency ? String(offers.priceCurrency) : undefined,
        availability: offers?.availability ? String(offers.availability) : undefined,
      });
    }
    if (type.includes('organization') && !siteName && node.name) {
      fields.push({
        fieldKey: 'brand.name',
        value: String(node.name),
        isUnknown: false,
        extractionMethod: 'JSON_LD',
        confidence: 0.95,
      });
    }
  }

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    fields,
    products,
    pageTitle,
    classification: classifyPage(url, html),
    excerpt: boundExcerpt(bodyText.slice(0, 500) || pageTitle || url),
  };
}
