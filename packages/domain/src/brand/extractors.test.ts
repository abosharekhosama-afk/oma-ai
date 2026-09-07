import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { boundExcerpt, extractFromHtml } from './extractors';

const fixtureRoot = join(process.cwd(), 'tests/fixtures/websites/acme');
const fixtureHtml = readFileSync(join(fixtureRoot, 'index.html'), 'utf8');

describe('extractors', () => {
  it('bounds excerpt length', () => {
    expect(boundExcerpt('x'.repeat(3000)).length).toBe(2000);
  });

  it('extracts brand name from fixture', () => {
    const r = extractFromHtml('https://acme.test/', fixtureHtml);
    expect(r.fields.find((f) => f.fieldKey === 'brand.name')?.isUnknown).toBe(false);
    expect(r.pageTitle).toBeTruthy();
  });

  it('extracts json-ld products', () => {
    const productsHtml = readFileSync(join(fixtureRoot, 'products.html'), 'utf8');
    const r = extractFromHtml('https://acme.test/products', productsHtml);
    expect(r.products.length).toBeGreaterThan(0);
    expect(r.classification).toBe('PRODUCT');
  });
});
