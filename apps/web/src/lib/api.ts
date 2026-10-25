import { resolveLocale, t as translate } from '@oma/i18n';

function getClientLocale() {
  if (typeof document === 'undefined') return resolveLocale(null);
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith('oma_locale='))
    ?.split('=')[1];
  return resolveLocale(raw ? decodeURIComponent(raw) : document.documentElement.lang || null);
}
let sessionInvalidNotified = false;

export function resetSessionInvalidFlag() {
  sessionInvalidNotified = false;
}

type CacheEntry = { at: number; data: unknown };
const getCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 12_000;

/** Drop cached GETs (call after mutations that change list data). */
export function invalidateApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    getCache.clear();
    inflight.clear();
    return;
  }
  for (const key of [...getCache.keys()]) {
    if (key.startsWith(pathPrefix) || key.includes(pathPrefix)) getCache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(pathPrefix) || key.includes(pathPrefix)) inflight.delete(key);
  }
}

const CODE_KEYS: Record<string, string> = {
  NETWORK: 'errors.network',
  PERMISSION_DENIED: 'errors.permission_denied',
  UNAUTHENTICATED: 'errors.unauthenticated',
  TENANT_REQUIRED: 'errors.tenant_required',
  NOT_FOUND: 'errors.not_found',
  CONFLICT_STATE: 'errors.conflict_state',
  CONFLICT_VERSION: 'errors.conflict_version',
  VALIDATION_FAILED: 'errors.validation_failed',
  RATE_LIMITED: 'errors.rate_limited',
  SCHEDULE_BLOCKED: 'error.schedule_blocked',
  CONTENT_REJECTED: 'error.content_rejected',
  BRAND_ARCHIVED: 'errors.brand_archived',
  CAMPAIGN_ARCHIVED: 'error.campaign_archived',
};

/** Localized, user-facing message for an API error (prefers the server's message_key). */
export function friendlyApiMessage(
  error: { code?: string; message_key?: string } | undefined | null,
  status: number,
): string {
  const locale = getClientLocale();
  const lookup = (key?: string) => {
    if (!key) return null;
    const v = translate(locale, key);
    return v && v !== key ? v : null;
  };
  return (
    lookup(error?.message_key) ??
    lookup(error?.code ? CODE_KEYS[error.code] : undefined) ??
    lookup(
      status === 403
        ? 'errors.permission_denied'
        : status === 404
          ? 'errors.not_found'
          : status === 429
            ? 'errors.rate_limited'
            : status === 401
              ? 'errors.unauthenticated'
              : status >= 500
                ? 'errors.internal'
                : 'errors.http',
    ) ??
    'Error'
  );
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  const cacheKey = path;

  if (isGet) {
    const hit = getCache.get(cacheKey);
    if (hit && Date.now() - hit.at < DEFAULT_TTL_MS) {
      return hit.data as T;
    }
    const pending = inflight.get(cacheKey);
    if (pending) return pending as Promise<T>;
  }

  const run = (async () => {
    const csrf =
      typeof document !== 'undefined'
        ? document.cookie
            .split('; ')
            .find((c) => c.startsWith('oma_csrf='))
            ?.split('=')[1]
        : undefined;
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (csrf && method !== 'GET') headers.set('x-csrf-token', decodeURIComponent(csrf));
    let res: Response;
    try {
      res = await fetch(path, { ...init, headers, credentials: 'include' });
    } catch (cause) {
      // Network/offline: surface a typed error (status 0) so UIs can show an offline state + retry.
      throw Object.assign(new Error(friendlyApiMessage({ code: 'NETWORK' }, 0)), {
        status: 0,
        code: 'NETWORK',
        cause,
      });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        const isAuthPath =
          path.includes('/api/v1/auth/login') ||
          path.includes('/api/v1/auth/register') ||
          path.includes('/api/v1/auth/logout') ||
          path.includes('/api/v1/auth/recovery');
        if (!isAuthPath && !sessionInvalidNotified) {
          sessionInvalidNotified = true;
          window.dispatchEvent(
            new CustomEvent('oma:session-invalid', {
              detail: { message: data?.error?.message ?? 'Session invalid' },
            }),
          );
        }
      }
      // Never surface raw server text/codes to users: map to a localized, plain-language message.
      throw Object.assign(new Error(friendlyApiMessage(data?.error, res.status)), {
        data,
        status: res.status,
        code: data?.error?.code,
      });
    }
    if (isGet) {
      getCache.set(cacheKey, { at: Date.now(), data });
    } else {
      // Mutations invalidate related caches broadly
      invalidateApiCache('/api/v1/');
    }
    return data as T;
  })();

  if (isGet) {
    inflight.set(cacheKey, run);
    try {
      return (await run) as T;
    } finally {
      inflight.delete(cacheKey);
    }
  }
  return run as Promise<T>;
}
