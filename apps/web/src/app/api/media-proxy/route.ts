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

function targetFromRequest(request: NextRequest): URL | null {
  const raw = new URL(request.url).searchParams.get('url');
  if (!raw) return null;
  try {
    const target = new URL(raw);
    if (target.protocol !== 'https:') return null;
    if (BLOCKED_HOSTS.has(target.hostname) || target.hostname.endsWith('.internal')) return null;
    return target;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const target = targetFromRequest(request);
  if (!target) {
    return new NextResponse('A valid HTTPS media URL is required', { status: 400 });
  }

  try {
    const upstream = await fetch(target, { redirect: 'follow' });
    if (!upstream.ok) {
      return new NextResponse('Failed to fetch media from source', { status: upstream.status });
    }

    const headers = new Headers({
      'cache-control': 'public, max-age=3600, s-maxage=3600',
      'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'access-control-allow-origin': '*',
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
