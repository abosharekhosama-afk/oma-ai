import net from 'node:net';
import { DomainError } from '../errors';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  '0.0.0.0',
  '255.255.255.255',
]);

const IPV4_BLOCKED_CIDRS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
] as const;

export type SsrfCheckResult = { ok: true } | { ok: false; reason: string };

export type SsrfPolicyOptions = {
  /** Test-only: allow loopback IPs/hostnames. Ignored unless the caller already gated production. */
  allowLoopback?: boolean;
};

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  return (
    (((parts[0] ?? 0) << 24) >>> 0) +
    ((parts[1] ?? 0) << 16) +
    ((parts[2] ?? 0) << 8) +
    (parts[3] ?? 0)
  );
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  if (!base) return false;
  const bits = Number(bitsRaw);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

function expandIpv6(ip: string): string {
  const cleaned = ip.split('%')[0] ?? ip;
  const [head, tail] = cleaned.split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = Math.max(0, 8 - headParts.length - tailParts.length);
  return [...headParts, ...Array(missing).fill('0'), ...tailParts]
    .map((p) => p.padStart(4, '0'))
    .join(':');
}

function ipv6ToBytes(ip: string): number[] {
  return expandIpv6(ip)
    .split(':')
    .flatMap((h) => {
      const n = parseInt(h, 16);
      return [(n >> 8) & 0xff, n & 0xff];
    });
}

function ipv6InPrefix(ip: string, prefix: string, bits: number): boolean {
  const a = ipv6ToBytes(ip);
  const b = ipv6ToBytes(prefix);
  const full = Math.floor(bits / 8);
  const rem = bits % 8;
  for (let i = 0; i < full; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  if (rem) {
    const mask = (0xff << (8 - rem)) & 0xff;
    if ((a[full]! & mask) !== (b[full]! & mask)) return false;
  }
  return true;
}

export function normalizeIpLiteral(ip: string): string {
  let value = ip.trim().toLowerCase();
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1);
  value = value.split('%')[0] ?? value;
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice(7);
    if (net.isIPv4(mapped)) return mapped;
  }
  if (net.isIPv6(value)) {
    const expanded = expandIpv6(value);
    if (expanded.startsWith('0000:0000:0000:0000:0000:ffff:')) {
      const parts = expanded.split(':');
      const hi = parseInt(parts[6] ?? '0', 16);
      const lo = parseInt(parts[7] ?? '0', 16);
      return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    }
  }
  return value;
}

export function isLoopbackIp(ip: string): boolean {
  const normalized = normalizeIpLiteral(ip);
  if (net.isIPv4(normalized)) return ipv4InCidr(normalized, '127.0.0.0/8');
  if (net.isIPv6(normalized)) return ipv6InPrefix(normalized, '::1', 128);
  return false;
}

export function isBlockedIpv4(ip: string): boolean {
  return IPV4_BLOCKED_CIDRS.some((cidr) => ipv4InCidr(ip, cidr)) || ip === '255.255.255.255';
}

export function isBlockedIpv6(ip: string): boolean {
  if (ipv6InPrefix(ip, '::', 128)) return true;
  if (ipv6InPrefix(ip, '::1', 128)) return true;
  if (ipv6InPrefix(ip, 'fc00::', 7)) return true;
  if (ipv6InPrefix(ip, 'fe80::', 10)) return true;
  if (ipv6InPrefix(ip, 'ff00::', 8)) return true;
  if (ipv6InPrefix(ip, '2001:db8::', 32)) return true;
  if (ipv6InPrefix(ip, '64:ff9b::', 96)) {
    const bytes = ipv6ToBytes(ip);
    const v4 = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
    return isBlockedIpv4(v4);
  }
  return false;
}

export function isBlockedIp(ip: string, options: SsrfPolicyOptions = {}): boolean {
  const normalized = normalizeIpLiteral(ip);
  if (options.allowLoopback && isLoopbackIp(normalized)) return false;
  if (net.isIPv4(normalized)) return isBlockedIpv4(normalized);
  if (net.isIPv6(normalized)) return isBlockedIpv6(normalized);
  return true;
}

export function isPrivateIpv4(host: string): boolean {
  const normalized = normalizeIpLiteral(host);
  if (!net.isIPv4(normalized)) return false;
  return isBlockedIpv4(normalized);
}

export function checkSsrfHost(host: string, options: SsrfPolicyOptions = {}): SsrfCheckResult {
  const normalized = host.toLowerCase().replace(/\.$/, '');
  if (!normalized) return { ok: false, reason: 'empty host' };
  if (options.allowLoopback && (normalized === 'localhost' || isLoopbackIp(normalized))) {
    return { ok: true };
  }
  if (BLOCKED_HOSTNAMES.has(normalized)) return { ok: false, reason: 'blocked hostname' };
  if (
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return { ok: false, reason: 'local domain' };
  }
  if (net.isIP(normalizeIpLiteral(normalized))) {
    if (isBlockedIp(normalized, options)) return { ok: false, reason: 'blocked ip' };
    return { ok: true };
  }
  return { ok: true };
}

export function assertSsrfAllowed(host: string, options: SsrfPolicyOptions = {}): void {
  const result = checkSsrfHost(host, options);
  if (!result.ok) {
    throw new DomainError('URL_SSRF_DENIED', result.reason, 400, 'errors.url_ssrf_denied');
  }
}
