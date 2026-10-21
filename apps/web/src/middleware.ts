import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Demo product shell: do not bounce unauthenticated /app traffic back to /login.
 * MembershipRouteGate + API guards still apply; a hard login↔app redirect loop
 * left the OmaDotsLoader stuck forever on /login.
 *
 * When a session cookie is present we pass through as usual.
 * When absent we still allow /app so the demo UI can open (gate shows UI on auth failure).
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*'] };
