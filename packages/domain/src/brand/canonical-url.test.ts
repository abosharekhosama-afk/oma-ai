import { describe, expect, it } from 'vitest';
import { canonicalHash, canonicalizeUrl } from './canonical-url';

describe('canonical-url', () => {
  it('strips hash and trailing slash', () => {
    expect(canonicalizeUrl('https://example.test/path/#frag')).toBe('https://example.test/path');
    expect(canonicalizeUrl('https://example.test/path/')).toBe('https://example.test/path');
  });

  it('produces stable hash', () => {
    const a = canonicalHash('https://example.test/a/');
    const b = canonicalHash('https://example.test/a');
    expect(a).toBe(b);
  });

  it('strips tracking params and sorts the rest', () => {
    expect(canonicalizeUrl('https://example.test/path?b=2&utm_source=ad&a=1&fbclid=xyz#x')).toBe(
      'https://example.test/path?a=1&b=2',
    );
  });
});
