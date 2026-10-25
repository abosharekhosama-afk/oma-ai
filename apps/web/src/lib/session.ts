/** Session timing helpers (pure; unit-tested). */

/** Refresh when less than this fraction of the TTL (or 24h, whichever is smaller) remains. */
export const REFRESH_WINDOW_MS = 24 * 3600_000;
/** setTimeout max (~24.8 days); longer waits are re-armed. */
const MAX_TIMER_MS = 2_147_000_000;

/** Delay until we should refresh the session, or 0 to refresh now; null if unknown. */
export function refreshDelayMs(
  expiresAtIso: string | null | undefined,
  now = Date.now(),
): number | null {
  if (!expiresAtIso) return null;
  const exp = Date.parse(expiresAtIso);
  if (Number.isNaN(exp)) return null;
  const left = exp - now;
  if (left <= 0) return 0;
  const window = Math.min(REFRESH_WINDOW_MS, Math.max(60_000, left / 2));
  return Math.min(MAX_TIMER_MS, Math.max(0, left - window));
}

/** Login URL that returns the user to where they were. */
export function loginUrlFor(
  location: { pathname: string; search: string },
  reason = 'session',
): string {
  const next = `${location.pathname}${location.search}`;
  const qs = new URLSearchParams({ reason });
  if (next.startsWith('/app') && next !== '/app' && next !== '/app/') qs.set('next', next);
  return `/login?${qs.toString()}`;
}

export const SESSION_OK_KEY = 'oma.session.ok';
