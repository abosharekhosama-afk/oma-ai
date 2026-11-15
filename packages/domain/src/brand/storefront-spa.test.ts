import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFromHtml } from './extractors';
import { parseIgroupContent } from './platform-catalog';
import { ProductCatalogAccumulator, catalogCoverage } from './product-catalog';

const dir = join(process.cwd(), 'tests/fixtures/websites/storefront-spa');
const read = (name: string) => readFileSync(join(dir, name), 'utf8');
const ORIGIN = 'https://shop.example';

describe('client-rendered storefront (sanitized regression fixtures)', () => {
  it('home page: featured badges and category tiles never become products', () => {
    const r = extractFromHtml(`${ORIGIN}/ar`, read('home.html'));
    expect(r.products).toEqual([]);
    const names = r.products.map((p) => p.name);
    for (const fake of ['مميز', 'ألعاب الحركة', 'ألعاب الحفلات', 'إلكترونيات الأطفال']) {
      expect(names).not.toContain(fake);
    }
  });

  it('category page is a collection with no products', () => {
    const r = extractFromHtml(`${ORIGIN}/ar/categories/motion-toys`, read('category.html'));
    expect(r.classification).toBe('COLLECTION');
    expect(r.products).toEqual([]);
  });

  it('product detail page: own gallery only, real price/category/specs', () => {
    const r = extractFromHtml(`${ORIGIN}/ar/products/item-101`, read('product-detail.html'));
    expect(r.classification).toBe('PRODUCT');
    expect(r.products).toHaveLength(1);
    const p = r.products[0]!;
    expect(p.name).toBe('كتاب الأصوات التفاعلي');
    expect(p.priceAmount).toBe('55');
    expect(p.priceCurrency).toBe('ILS');
    expect(p.compareAtPrice).toBe('70');
    expect(p.availability).toBe('InStock');
    expect(p.skuPublic).toBe('toy-src-101');
    expect(p.category).toContain('صوت');
    expect(p.description).toContain('أصوات الحيوانات');
    expect(p.extractionSource).toBe('DOM_DETAIL');
    const urls = (p.media ?? []).map((m) => m.url);
    // focal + thumbnails, de-duplicated (resize query ignored); no banner, logo, related or payment art.
    expect(urls).toEqual([
      'https://cdn.example/media/p101-a.webp',
      'https://cdn.example/media/p101-b.webp?w=200',
      'https://cdn.example/media/p101-c.webp',
    ]);
    expect(urls.join(' ')).not.toMatch(/p102|p103|banner|logo|payment/);
    expect(p.attributes?.map((a) => a.label)).toEqual(
      expect.arrayContaining(['العمر', 'المهارات']),
    );
  });

  it('regression: crawling many pages never piles media onto one item', () => {
    const acc = new ProductCatalogAccumulator();
    const pages: Array<[string, string]> = [
      [`${ORIGIN}/ar`, 'home.html'],
      [`${ORIGIN}/ar/categories/motion-toys`, 'category.html'],
      [`${ORIGIN}/ar/products/item-101`, 'product-detail.html'],
      [`${ORIGIN}/en/products/item-101`, 'product-detail.html'],
    ];
    for (const [url, file] of pages) {
      for (const product of extractFromHtml(url, read(file)).products) acc.add(product, url);
    }
    const list = acc.list();
    expect(list).toHaveLength(1);
    for (const { product } of list) {
      expect((product.media ?? []).length).toBeLessThanOrEqual(3);
    }
  });

  it('platform catalog merges with the rendered page by canonical URL', () => {
    const products = parseIgroupContent(JSON.parse(read('igroup-content.json')), {
      siteOrigin: ORIGIN,
      locale: 'ar',
      expected: { apiUrl: 'https://api.example', companyId: 'company-1', siteId: 'site-1' },
    });
    const acc = new ProductCatalogAccumulator();
    for (const p of products) acc.add(p);
    const page = extractFromHtml(`${ORIGIN}/ar/products/item-101`, read('product-detail.html'));
    acc.add(page.products[0]!, `${ORIGIN}/ar/products/item-101`);
    expect(acc.size).toBe(2);
    const book = acc.list().find((e) => e.product.platformId === 'igroup:p-101')!;
    expect(book.pageUrls).toEqual([`${ORIGIN}/ar/products/item-101`]);
    expect(book.product.extractionSource).toBe('PLATFORM_API');
    expect(book.product.media?.map((m) => m.url)).toEqual([
      'https://cdn.example/media/p101-a.webp',
      'https://cdn.example/media/p101-b.webp',
      'https://cdn.example/media/p101-c.webp',
    ]);
    const coverage = catalogCoverage(
      acc.list().map(({ product }) => ({
        kind: product.kind,
        description: product.description,
        priceAmount: product.priceAmount,
        category: product.category,
        availability: product.availability,
        mediaCount: product.media?.length ?? 0,
      })),
    );
    expect(coverage).toMatchObject({ products: 2, withMedia: 2, withPrice: 2, withCategory: 2 });
  });
});
