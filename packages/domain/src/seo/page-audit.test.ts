import { describe, expect, it } from 'vitest';
import { evaluatePageSeo, scoreSeoAudit } from './page-audit';

describe('page-audit', () => {
  it('scores healthy product page', () => {
    const findings = evaluatePageSeo({
      url: 'https://shop.test/p/x',
      title: 'Vitamin C serum for bright skin care routine',
      metaDescription: 'A '.repeat(30).trim(),
      h1: 'Vitamin C serum',
      excerptLength: 800,
      classification: 'PRODUCT',
      productDescription: 'Daily serum',
      hasCanonical: true,
    });
    expect(findings.find((f) => f.code === 'SEO_TITLE_MISSING')).toBeUndefined();
    expect(scoreSeoAudit(findings)).toBeGreaterThan(70);
  });
});