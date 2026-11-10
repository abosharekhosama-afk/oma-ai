import { createHash } from 'node:crypto';

const TRACKING_PARAM_EXACT = new Set([
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'mc_eid',
  'mc_cid',
  'igshid',
  '_ga',
  '_gl',
  'yclid',
  'twclid',
  'li_fat_id',
  'ref',
  'ref_src',
  'ref_url',
  'spm',
  'ncid',
  'ocid',
]);

const TRACKING_PARAM_PREFIXES = ['utm_', 'mtm_', 'pk_', 'hsa_', 'itm_'];

export function isTrackingQueryParam(name: string): boolean {
  const key = name.toLowerCase();
  if (TRACKING_PARAM_EXACT.has(key)) return true;
  return TRACKING_PARAM_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function canonicalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  let path = parsed.pathname || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  parsed.pathname = path;
  const kept: Array<[string, string]> = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    if (isTrackingQueryParam(key)) continue;
    kept.push([key, value]);
  }
  kept.sort(([a], [b]) => a.localeCompare(b));
  parsed.search = '';
  for (const [key, value] of kept) parsed.searchParams.append(key, value);
  return parsed.toString();
}

export function canonicalHash(url: string): string {
  return createHash('sha256').update(canonicalizeUrl(url)).digest('hex');
}

export function contentHash(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}
