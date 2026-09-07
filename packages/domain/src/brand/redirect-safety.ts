import { checkSsrfHost } from './ssrf-policy';
import { normalizePublicUrl } from './url-normalize';

export type RedirectValidationResult =
  { ok: true; url: string; host: string } | { ok: false; code: string; reason: string };

export function validateRedirectTarget(url: string): RedirectValidationResult {
  const normalized = normalizePublicUrl(url);
  if (!normalized.ok) {
    return { ok: false, code: normalized.code, reason: normalized.reason };
  }
  const ssrf = checkSsrfHost(normalized.host);
  if (!ssrf.ok) {
    return { ok: false, code: 'URL_SSRF_DENIED', reason: ssrf.reason };
  }
  return { ok: true, url: normalized.normalizedUrl, host: normalized.host };
}

export function validateRedirectChain(urls: string[]): RedirectValidationResult {
  for (const url of urls) {
    const result = validateRedirectTarget(url);
    if (!result.ok) return result;
  }
  return validateRedirectTarget(urls[urls.length - 1] ?? '');
}
