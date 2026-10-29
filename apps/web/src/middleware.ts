import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protect /app/* behind a session cookie. Unauthenticated users go to /login.
 * Login itself must establish a real session (API sets httpOnly oma_session)
 * before navigating to /app — never auto-redirect without a cookie, or a
 * redirect loop with the dots loader will return.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const routePath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  // Old invitation links must leave /app before the authenticated shell gate.
  if (routePath === '/app/onboarding' && req.nextUrl.searchParams.has('invite')) {
    const url = req.nextUrl.clone();
    const token = req.nextUrl.searchParams.get('invite');
    url.pathname = '/invite';
    url.search = '';
    if (token) url.searchParams.set('token', token);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith('/app')) {
    const session = req.cookies.get(process.env.SESSION_COOKIE_NAME ?? 'oma_session');
    if (!session?.value) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      // Preserve deep link for post-login return
      if (pathname !== '/app' && pathname !== '/app/') {
        url.searchParams.set('next', pathname + req.nextUrl.search);
      }
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*'] };
