import { api } from '../api';

export type DemoLocaleCopy = { en: string; ar: string };

export function pickCopy(copy: DemoLocaleCopy, locale: string): string {
  return locale.toLowerCase().startsWith('ar') ? copy.ar : copy.en;
}

export type DemoApiResult<T> = { data: T };

/** Fetch a demo endpoint under `/api/v1/demo/*`. */
export async function demoApi<T>(path: string, init?: RequestInit): Promise<T> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const res = await api<DemoApiResult<T>>(`/api/v1/demo${normalized}`, init);
  return res.data;
}

export function isDemoForbidden(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 403,
  );
}

export function demoErrorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}
