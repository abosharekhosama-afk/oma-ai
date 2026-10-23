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
    const res = await fetch(path, { ...init, headers, credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        const isAuthPath =
          path.includes('/api/v1/auth/login') ||
          path.includes('/api/v1/auth/register') ||
          path.includes('/api/v1/auth/logout');
        if (!isAuthPath && !sessionInvalidNotified) {
          sessionInvalidNotified = true;
          window.dispatchEvent(
            new CustomEvent('oma:session-invalid', {
              detail: { message: data?.error?.message ?? 'Session invalid' },
            }),
          );
        }
      }
      throw Object.assign(new Error(data?.error?.message ?? res.statusText), {
        data,
        status: res.status,
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
