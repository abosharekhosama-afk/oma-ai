import { describe, expect, it } from 'vitest';
import { evaluatePageSeo, parsePageSeoSignalsFromExcerpt, scoreSeoAudit } from './page-audit';

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

  it('parses meta and h1 from excerpt html', () => {
    const html = `<html><head><meta name="description" content="Shop organic skincare"/></head>
      <body><h1>Serum</h1><p>Long body text here</p></body></html>`;
    const s = parsePageSeoSignalsFromExcerpt(html);
    expect(s.metaDescription).toBe('Shop organic skincare');
    expect(s.h1).toBe('Serum');
    expect(s.plainTextLength).toBeGreaterThan(10);
  });
});
