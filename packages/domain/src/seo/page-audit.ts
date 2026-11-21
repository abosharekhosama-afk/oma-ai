export type SeoSeverity = 'critical' | 'warning' | 'info';

export type SeoFindingCode =
  | 'SEO_TITLE_MISSING'
  | 'SEO_TITLE_SHORT'
  | 'SEO_TITLE_LONG'
  | 'SEO_META_DESC_MISSING'
  | 'SEO_META_DESC_SHORT'
  | 'SEO_NOINDEX'
  | 'SEO_CANONICAL_MISSING'
  | 'SEO_H1_MISSING'
  | 'SEO_THIN_CONTENT'
  | 'SEO_HTTP_ERROR'
  | 'SEO_PRODUCT_NO_DESCRIPTION'
  | 'SEO_DUPLICATE_TITLE';

export type SeoPageFinding = {
  code: SeoFindingCode;
  severity: SeoSeverity;
  detail?: string;
};

export type SeoPageInput = {
  url: string;
  httpStatus?: number | null;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  excerptLength?: number;
  noindex?: boolean;
  hasCanonical?: boolean;
  classification?: string;
  productDescription?: string | null;
};

const SEVERITY_WEIGHT: Record<SeoSeverity, number> = {
  critical: 12,
  warning: 6,
  info: 2,
};

export function evaluatePageSeo(input: SeoPageInput): SeoPageFinding[] {
  const findings: SeoPageFinding[] = [];
  if (input.httpStatus != null && input.httpStatus >= 400) {
    findings.push({ code: 'SEO_HTTP_ERROR', severity: 'critical', detail: String(input.httpStatus) });
  }
  const title = input.title?.trim() ?? '';
  if (!title) findings.push({ code: 'SEO_TITLE_MISSING', severity: 'critical' });
  else if (title.length < 15) findings.push({ code: 'SEO_TITLE_SHORT', severity: 'warning' });
  else if (title.length > 65) findings.push({ code: 'SEO_TITLE_LONG', severity: 'info' });

  const desc = input.metaDescription?.trim() ?? '';
  if (!desc) findings.push({ code: 'SEO_META_DESC_MISSING', severity: 'warning' });
  else if (desc.length < 50) findings.push({ code: 'SEO_META_DESC_SHORT', severity: 'info' });

  if (input.noindex) findings.push({ code: 'SEO_NOINDEX', severity: 'warning' });
  if (input.hasCanonical === false)
    findings.push({ code: 'SEO_CANONICAL_MISSING', severity: 'info' });

  const h1 = input.h1?.trim() ?? '';
  if (!h1) findings.push({ code: 'SEO_H1_MISSING', severity: 'warning' });

  const len = input.excerptLength ?? 0;
  if (len > 0 && len < 200) findings.push({ code: 'SEO_THIN_CONTENT', severity: 'info' });

  if (
    input.classification === 'PRODUCT' &&
    !(input.productDescription?.trim() || desc)
  ) {
    findings.push({ code: 'SEO_PRODUCT_NO_DESCRIPTION', severity: 'warning' });
  }
  return findings;
}

export function scoreSeoAudit(findings: Array<{ severity: SeoSeverity }>): number {
  let penalty = 0;
  for (const f of findings) penalty += SEVERITY_WEIGHT[f.severity];
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function h1FromExcerpt(excerpt: string): string | null {
  const m = excerpt.match(/<h1[^>]*>([^<]{1,200})<\/h1>/i);
  return m?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
}

/** Parse on-page SEO signals from stored HTML excerpt (no live fetch). */
export function parsePageSeoSignalsFromExcerpt(excerpt: string): {
  metaDescription: string | null;
  h1: string | null;
  noindex: boolean;
  hasCanonical: boolean;
  plainTextLength: number;
} {
  const meta =
    excerpt.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    excerpt.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const og =
    excerpt.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    excerpt.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  const plain = excerpt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    metaDescription: (meta?.[1] ?? og?.[1] ?? null)?.trim() || null,
    h1: h1FromExcerpt(excerpt),
    noindex: /\bnoindex\b/i.test(excerpt),
    hasCanonical: /<link[^>]+rel=["'][^"']*canonical[^"']*["']/i.test(excerpt),
    plainTextLength: plain.length,
  };
}

export type SeoAuditSummary = {
  by_code: Record<string, number>;
  pages_audited: number;
  duplicate_titles: string[];
  critical_count: number;
  warning_count: number;
};

export function summarizeSeoFindings(
  pages: Array<{ title: string | null; url: string }>,
  findings: Array<SeoPageFinding & { pageUrl: string }>,
): Omit<SeoAuditSummary, 'pages_audited'> & { pages_audited: number } {
  const by_code: Record<string, number> = {};
  let critical_count = 0;
  let warning_count = 0;
  for (const f of findings) {
    by_code[f.code] = (by_code[f.code] ?? 0) + 1;
    if (f.severity === 'critical') critical_count++;
    if (f.severity === 'warning') warning_count++;
  }
  const titles = new Map<string, string[]>();
  for (const p of pages) {
    const key = (p.title ?? '').trim().toLowerCase();
    if (!key) continue;
    const list = titles.get(key) ?? [];
    list.push(p.url);
    titles.set(key, list);
  }
  const duplicate_titles = [...titles.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([title]) => title);
  return {
    by_code,
    pages_audited: pages.length,
    duplicate_titles,
    critical_count,
    warning_count,
  };
}

export function metaFromFields(fields: Array<{ fieldKey: string; value: unknown }>): {
  metaDescription: string | null;
} {
  const row = fields.find((f) => f.fieldKey === 'brand.description');
  const v = row?.value;
  return { metaDescription: typeof v === 'string' ? v : null };
}