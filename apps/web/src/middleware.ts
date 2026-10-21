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
  if (pathname.startsWith('/app')) {
    const session = req.cookies.get(process.env.SESSION_COOKIE_NAME ?? 'oma_session');
    if (!session?.value) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      // Preserve deep link for post-login return
      if (pathname !== '/app' && pathname !== '/app/') {
        url.searchParams.set('next', pathname);
      }
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*'] };
