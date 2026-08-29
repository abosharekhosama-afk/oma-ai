import { api } from './api';

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

export async function apiMutate<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey);
  const { idempotencyKey: _key, ...rest } = init;
  return api<T>(path, { ...rest, headers });
}

export function getApiError(err: unknown): {
  message: string;
  status?: number;
  code?: string;
} {
  if (err instanceof Error) {
    const e = err as Error & {
      status?: number;
      data?: { error?: { code?: string; message?: string } };
    };
    return {
      message: e.data?.error?.message ?? e.message,
      status: e.status,
      code: e.data?.error?.code,
    };
  }
  return { message: 'Unknown error' };
}

export function isPermissionDenied(err: unknown): boolean {
  const { status, code } = getApiError(err);
  return status === 403 || code === 'PERMISSION_DENIED';
}

/** The session carries no active company yet, so the user must pick one. */
export function isTenantRequired(err: unknown): boolean {
  return getApiError(err).code === 'TENANT_REQUIRED';
}
