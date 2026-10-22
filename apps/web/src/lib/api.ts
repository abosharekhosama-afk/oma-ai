let sessionInvalidNotified = false;

export function resetSessionInvalidFlag() {
  sessionInvalidNotified = false;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const csrf =
    typeof document !== 'undefined'
      ? document.cookie
          .split('; ')
          .find((c) => c.startsWith('oma_csrf='))
          ?.split('=')[1]
      : undefined;
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (csrf && init.method && init.method !== 'GET')
    headers.set('x-csrf-token', decodeURIComponent(csrf));
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
  return data as T;
}
