/** Public web origin and checkout redirect guards. Never accept javascript: or credentialed URLs. */

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

export function resolvePublicAppOrigin(raw?: string | null): string {
  const fallback = 'http://127.0.0.1:3000';
  const value = (raw ?? '').trim();
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.username || url.password) return fallback;
    const local = LOCAL_HOSTS.has(url.hostname);
    if (url.protocol === 'https:') return url.origin;
    if (url.protocol === 'http:' && local) return url.origin;
    return fallback;
  } catch {
    return fallback;
  }
}

export function isSafeCheckoutRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}
