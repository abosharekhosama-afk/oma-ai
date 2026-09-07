import { describe, expect, it } from 'vitest';
import {
  assertCompanyName,
  assertSlugCandidate,
  isReservedSlug,
  slugifyCompanyName,
  uniquifySlug,
} from './slug';

describe('company slug helpers', () => {
  it('normalizes and validates names', () => {
    expect(assertCompanyName('  Acme Co  ')).toBe('Acme Co');
    expect(() => assertCompanyName('A')).toThrow();
  });

  it('slugifies names and rejects reserved bases via assert', () => {
    expect(slugifyCompanyName('Acme Co!')).toBe('acme-co');
    expect(isReservedSlug('admin')).toBe(true);
    expect(() => assertSlugCandidate('admin')).toThrow(/Reserved/);
  });

  it('allocates a unique slug when the base is taken', async () => {
    const taken = new Set(['acme']);
    const slug = await uniquifySlug('acme', (s) => taken.has(s));
    expect(slug).not.toBe('acme');
    expect(slug.startsWith('acme-')).toBe(true);
  });
});
