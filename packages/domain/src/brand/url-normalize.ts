import { DomainError } from '../errors';

export type NormalizeUrlResult =
  | { ok: true; normalizedUrl: string; host: string }
  | { ok: false; code: 'URL_SCHEME_DENIED' | 'VALIDATION_FAILED'; reason: string };

export function normalizePublicUrl(raw: string): NormalizeUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, code: 'VALIDATION_FAILED', reason: 'URL is required' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: 'VALIDATION_FAILED', reason: 'Invalid URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, code: 'URL_SCHEME_DENIED', reason: 'HTTPS required' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, code: 'URL_SCHEME_DENIED', reason: 'URL credentials denied' };
  }

  if (parsed.port && parsed.port !== '443') {
    return { ok: false, code: 'URL_SCHEME_DENIED', reason: 'Non-standard port denied' };
  }

  parsed.hash = '';
  const normalizedUrl = parsed.toString().replace(/\/$/, '') || parsed.origin;
  return { ok: true, normalizedUrl, host: parsed.hostname.toLowerCase() };
}

export function assertNormalizedUrl(raw: string): { normalizedUrl: string; host: string } {
  const result = normalizePublicUrl(raw);
  if (!result.ok) {
    throw new DomainError(result.code, result.reason, 400, `errors.${result.code.toLowerCase()}`);
  }
  return { normalizedUrl: result.normalizedUrl, host: result.host };
}
