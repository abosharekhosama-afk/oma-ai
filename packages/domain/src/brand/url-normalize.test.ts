import { describe, expect, it } from 'vitest';
import { normalizePublicUrl } from './url-normalize';

describe('url-normalize', () => {
  it('normalizes https URLs', () => {
    const r = normalizePublicUrl('https://example.test/path/');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.normalizedUrl).toBe('https://example.test/path');
      expect(r.host).toBe('example.test');
    }
  });

  it('rejects http', () => {
    const r = normalizePublicUrl('http://example.test');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_SCHEME_DENIED');
  });

  it('rejects credentials', () => {
    const r = normalizePublicUrl('https://user:pass@example.test');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('URL_SCHEME_DENIED');
  });

  it('rejects custom ports', () => {
    const r = normalizePublicUrl('https://example.test:8080');
    expect(r.ok).toBe(false);
  });
});
