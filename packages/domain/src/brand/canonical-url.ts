import { createHash } from 'node:crypto';

export function canonicalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  let path = parsed.pathname || '/';
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  parsed.pathname = path;
  return parsed.toString();
}

export function canonicalHash(url: string): string {
  return createHash('sha256').update(canonicalizeUrl(url)).digest('hex');
}

export function contentHash(text: string): string {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}
