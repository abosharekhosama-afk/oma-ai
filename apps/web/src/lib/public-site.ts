/**
 * Canonical public origin for SEO (sitemap, robots, Open Graph absolute URLs).
 * Prefer explicit production URL envs over platform defaults.
 */
export function resolvePublicSiteUrl(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.WEB_BASE_URL,
    process.env.WEB_ORIGIN,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url;
    } catch {
      /* try next */
    }
  }

  return new URL('http://127.0.0.1:3000');
}

/** Paths indexable by search engines (marketing + auth entry + legal). */
export const PUBLIC_INDEXABLE_PATHS = ['/', '/login', '/register', '/privacy', '/terms'] as const;

export function publicSiteIndexable(): boolean {
  const url = resolvePublicSiteUrl();
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return false;
  if (process.env.OMA_PUBLIC_SEO_INDEX === '0') return false;
  return true;
}

export function absolutePublicUrl(path: string): string {
  const base = resolvePublicSiteUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalized, base).toString();
}
