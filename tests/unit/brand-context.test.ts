import { afterEach, describe, expect, it } from 'vitest';
import {
  buildBrandContext,
  brandContextCacheKey,
  clearBrandContextCache,
  compactBrandContext,
  invalidateBrandContextCache,
  readBrandContextCache,
  writeBrandContextCache,
} from '@oma/domain';

describe('brand context builder', () => {
  afterEach(() => {
    clearBrandContextCache();
  });

  it('uses only an approved profile and ignores other tenants', () => {
    const approved = buildBrandContext({
      tenantId: 't1',
      brandId: 'b1',
      brandName: 'Acme',
      profile: {
        id: 'p1',
        tenantId: 't1',
        brandId: 'b1',
        status: 'APPROVED',
        sectionsJson: JSON.stringify({
          overview: { description: 'Fresh juices' },
          tone: { summary: 'Friendly' },
          audiences: { summary: 'Young families' },
          messaging: { summary: 'Daily freshness' },
          catalog: { products: 'Orange juice', services: 'Delivery' },
          languages: ['en', 'ar'],
          banned_words: ['miracle'],
        }),
      },
      claims: [
        { fieldKey: 'brand.tone', text: 'Warm and clear', reviewStatus: 'ACCEPTED' },
        { fieldKey: 'brand.messaging', text: 'Guaranteed cure', reviewStatus: 'REJECTED' },
      ],
    });
    expect(approved.usedApprovedProfile).toBe(true);
    expect(approved.profileVersionId).toBe('p1');
    expect(approved.overview).toMatch(/Fresh juices/);
    expect(approved.toneOfVoice).toMatch(/Friendly/);
    expect(approved.doClaims.some((item) => item.includes('Warm and clear'))).toBe(true);
    expect(approved.dontClaims.some((item) => item.includes('Guaranteed cure'))).toBe(true);
    expect(approved.bannedWords).toContain('miracle');
    expect(approved.compactText).toContain('brandName: Acme');

    const draft = buildBrandContext({
      tenantId: 't1',
      brandId: 'b1',
      brandName: 'Acme',
      profile: {
        id: 'p2',
        tenantId: 't1',
        brandId: 'b1',
        status: 'DRAFT',
        sectionsJson: JSON.stringify({ overview: { description: 'Should not appear' } }),
      },
    });
    expect(draft.usedApprovedProfile).toBe(false);
    expect(draft.overview).toBe('');

    const foreign = buildBrandContext({
      tenantId: 't1',
      brandId: 'b1',
      brandName: 'Acme',
      profile: {
        id: 'p3',
        tenantId: 'other-tenant',
        brandId: 'b1',
        status: 'APPROVED',
        sectionsJson: JSON.stringify({ overview: { description: 'Leak' } }),
      },
    });
    expect(foreign.usedApprovedProfile).toBe(false);
    expect(foreign.overview).toBe('');
  });

  it('truncates oversized context to the token budget', () => {
    const oversized = buildBrandContext({
      tenantId: 't1',
      brandId: 'b1',
      brandName: 'Acme',
      maxTokens: 180,
      profile: {
        id: 'p1',
        tenantId: 't1',
        brandId: 'b1',
        status: 'APPROVED',
        sectionsJson: JSON.stringify({
          overview: { description: 'word '.repeat(400) },
          tone: { summary: 'tone '.repeat(80) },
        }),
      },
      claims: Array.from({ length: 20 }, (_, i) => ({
        fieldKey: `brand.extra.${i}`,
        text: `accepted claim ${i} ${'text '.repeat(20)}`,
        reviewStatus: 'ACCEPTED' as const,
      })),
    });
    expect(oversized.truncated).toBe(true);
    expect(oversized.estimatedTokens).toBeLessThanOrEqual(220);
    const again = compactBrandContext(oversized, 180);
    expect(again.estimatedTokens).toBeLessThanOrEqual(220);
  });

  it('caches per approved version and invalidates on approval', () => {
    const ctx = buildBrandContext({
      tenantId: 't1',
      brandId: 'b1',
      brandName: 'Acme',
      profile: {
        id: 'p1',
        tenantId: 't1',
        brandId: 'b1',
        status: 'APPROVED',
        sectionsJson: JSON.stringify({ overview: { description: 'Cached' } }),
      },
    });
    const key = brandContextCacheKey('t1', 'b1', 'p1');
    writeBrandContextCache(key, ctx);
    expect(readBrandContextCache(key)?.overview).toBe('Cached');
    invalidateBrandContextCache('t1', 'b1');
    expect(readBrandContextCache(key)).toBeNull();
    expect(readBrandContextCache(brandContextCacheKey('t2', 'b1', 'p1'))).toBeNull();
  });
});
