const DEFAULT_ALLOWED_PORTS = new Set([80, 443]);

export type FetchUrlPolicy = {
  allowedPorts: Set<number>;
  allowAnyPort: boolean;
};

export function parseAllowedPorts(raw: string | undefined, fallback = [80, 443]): number[] {
  const source = raw?.trim() ? raw : fallback.join(',');
  const ports = source
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((port) => Number.isInteger(port) && port > 0 && port < 65536);
  return ports.length > 0 ? ports : fallback;
}

export function defaultPortForProtocol(protocol: string): number {
  if (protocol === 'http:') return 80;
  if (protocol === 'https:') return 443;
  return -1;
}

export function apexHostKey(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
}

export function isWwwApexPair(a: string, b: string): boolean {
  return apexHostKey(a) === apexHostKey(b);
}

export function parseFetchableUrl(
  raw: string,
  policy: FetchUrlPolicy = { allowedPorts: DEFAULT_ALLOWED_PORTS, allowAnyPort: false },
): { ok: true; url: URL } | { ok: false; code: string; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, code: 'VALIDATION_FAILED', reason: 'Invalid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'URL_SCHEME_DENIED', reason: 'Only http and https are allowed' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: 'URL_SCHEME_DENIED', reason: 'URL credentials denied' };
  }
  const port = parsed.port ? Number(parsed.port) : defaultPortForProtocol(parsed.protocol);
  if (!policy.allowAnyPort && !policy.allowedPorts.has(port)) {
    return { ok: false, code: 'URL_SCHEME_DENIED', reason: 'Non-standard port denied' };
  }
  return { ok: true, url: parsed };
}

export function shouldFollowRedirect(
  from: string,
  to: string,
): { follow: boolean; reason?: string } {
  let current: URL;
  let next: URL;
  try {
    current = new URL(from);
    next = new URL(to, from);
  } catch {
    return { follow: false, reason: 'invalid redirect target' };
  }
  if (next.username || next.password) return { follow: false, reason: 'credentials in redirect' };
  if (current.protocol === 'https:' && next.protocol === 'http:') {
    return { follow: false, reason: 'https to http downgrade' };
  }
  if (!isWwwApexPair(current.hostname, next.hostname)) {
    return { follow: false, reason: 'cross-origin redirect' };
  }
  return { follow: true };
}

export function isInCrawlScope(startUrl: string, candidateUrl: string): boolean {
  try {
    const start = new URL(startUrl);
    const candidate = new URL(candidateUrl, startUrl);
    if (candidate.username || candidate.password) return false;
    if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') return false;
    return isWwwApexPair(start.hostname, candidate.hostname);
  } catch {
    return false;
  }
}
