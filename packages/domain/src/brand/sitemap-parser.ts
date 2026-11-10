const LOC_RE = /<loc\s*>\s*([^<]+)\s*<\/loc\s*>/gi;

function decodeLoc(raw: string): string | null {
  const value = raw
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type ParsedSitemap = {
  kind: 'urlset' | 'index' | 'unknown';
  urls: string[];
  sitemaps: string[];
};

export function parseSitemapXml(xml: string, limit = 500): ParsedSitemap {
  const locs: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(LOC_RE);
  while ((match = re.exec(xml)) && locs.length < limit * 2) {
    const decoded = decodeLoc(match[1] ?? '');
    if (decoded) locs.push(decoded);
  }
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const isUrlset = /<urlset[\s>]/i.test(xml);
  if (isIndex) {
    return { kind: 'index', urls: [], sitemaps: locs.slice(0, limit) };
  }
  if (isUrlset) {
    return { kind: 'urlset', urls: locs.slice(0, limit), sitemaps: [] };
  }
  return { kind: 'unknown', urls: locs.slice(0, limit), sitemaps: [] };
}
