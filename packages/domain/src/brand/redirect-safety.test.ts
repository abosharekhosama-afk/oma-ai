import { describe, expect, it } from 'vitest';
import { validateRedirectChain, validateRedirectTarget } from './redirect-safety';

describe('redirect-safety', () => {
  it('validates safe redirect', () => {
    const r = validateRedirectTarget('https://example.test/page');
    expect(r.ok).toBe(true);
  });

  it('rejects redirect to private host', () => {
    const r = validateRedirectTarget('https://127.0.0.1/page');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_SSRF_DENIED');
  });

  it('rejects chain with private hop', () => {
    const r = validateRedirectChain(['https://example.test/a', 'https://localhost/secret']);
    expect(r.ok).toBe(false);
  });
});
