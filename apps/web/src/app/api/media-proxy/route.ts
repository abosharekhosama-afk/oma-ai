import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254',
  'metadata.google.internal',
]);

const PRIVATE_IP_RE =
  /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.|fc00:|fd00:|fe80:)/i;

const SAFE_MEDIA_MIME_RE =
  /^(?:image\/(?:jpeg|png|webp|gif|avif)|video\/(?:mp4|webm|quicktime)|audio\/(?:mpeg|mp4|ogg|wav))(?:\s*;.*)?$/i;

export function isAllowedMediaTarget(raw: string | null): URL | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const target = new URL(raw);
    if (target.protocol !== 'https:') return null;
    if (target.username || target.password) return null;
    const host = target.hostname.toLowerCase();
    if (
      BLOCKED_HOSTS.has(host) ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      PRIVATE_IP_RE.test(host)
    ) {
      return null;
    }
    return target;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get('url');
  const target = isAllowedMediaTarget(raw);
  if (!target) {
    return new NextResponse('A valid public HTTPS media URL is required', { status: 400 });
  }

  try {
    const upstream = await fetch(target, { redirect: 'follow' });
    if (!upstream.ok) {
      return new NextResponse('Failed to fetch media from source', { status: upstream.status });
    }

    const rawMime = upstream.headers.get('content-type') || 'application/octet-stream';
    // Never render HTML or SVG inline from external media URLs (prevents stored XSS)
    const safeMime = SAFE_MEDIA_MIME_RE.test(rawMime) ? rawMime : 'application/octet-stream';

    const headers = new Headers({
      'cache-control': 'public, max-age=3600, s-maxage=3600',
      'content-type': safeMime,
      'content-disposition': safeMime === 'application/octet-stream' ? 'attachment' : 'inline',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    });
    for (const name of ['content-length', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return new NextResponse('Failed to fetch media from source', { status: 502 });
  }
}
