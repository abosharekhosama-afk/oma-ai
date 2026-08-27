const PRIVATE_IPV4_BLOCKS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
];

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata', '0.0.0.0']);

export type SsrfCheckResult = { ok: true } | { ok: false; reason: string };

export function isPrivateIpv4(host: string): boolean {
  return PRIVATE_IPV4_BLOCKS.some((re) => re.test(host));
}

export function checkSsrfHost(host: string): SsrfCheckResult {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  if (!normalized) return { ok: false, reason: 'empty host' };
  if (BLOCKED_HOSTNAMES.has(normalized)) return { ok: false, reason: 'blocked hostname' };
  if (
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return { ok: false, reason: 'private ipv6' };
  }
  if (isPrivateIpv4(normalized)) return { ok: false, reason: 'private ipv4' };
  if (normalized.endsWith('.local') || normalized.endsWith('.internal')) {
    return { ok: false, reason: 'local domain' };
  }
  return { ok: true };
}

import { DomainError } from '../errors';

export function assertSsrfAllowed(host: string): void {
  const result = checkSsrfHost(host);
  if (!result.ok) {
    throw new DomainError('URL_SSRF_DENIED', result.reason, 400, 'errors.url_ssrf_denied');
  }
}
