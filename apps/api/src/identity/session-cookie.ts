import type { Response } from 'express';
import { randomBytes } from 'node:crypto';

export function setSessionCookie(res: Response, token: string) {
  const name = process.env.SESSION_COOKIE_NAME ?? 'oma_session';
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(name, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 604800) * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  const name = process.env.SESSION_COOKIE_NAME ?? 'oma_session';
  res.clearCookie(name, { path: '/' });
}

export function setCsrfCookie(res: Response): string {
  const name = process.env.CSRF_COOKIE_NAME ?? 'oma_csrf';
  const token = randomBytes(24).toString('base64url');
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(name, token, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    // Same lifetime as the session cookie: a browser-session-only CSRF cookie disappeared on
    // browser restart while the 7-day session survived, so every write failed with errors.csrf.
    maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 604800) * 1000,
  });
  return token;
}

/** Re-issue the CSRF cookie only when the browser no longer has it; returns the active token. */
export function ensureCsrfCookie(req: { cookies?: Record<string, string> }, res: Response): string {
  const name = process.env.CSRF_COOKIE_NAME ?? 'oma_csrf';
  const existing = req.cookies?.[name];
  return existing || setCsrfCookie(res);
}
