import { describe, expect, it } from 'vitest';
import {
  buildMarketingSeedUrls,
  buildSitemapSeedUrls,
  isCatalogLikePath,
  isLowValueCrawlPath,
  isMarketingSeedPathname,
  isProductLikePathname,
  parseExtraPathSeeds,
} from './crawl-seeds';

describe('crawl-seeds', () => {
  it('builds marketing seed urls from defaults', () => {
    const urls = buildMarketingSeedUrls('https://brand.test');
    expect(urls).toContain('https://brand.test/products');
    expect(urls).toContain('https://brand.test/services');
  });

  it('parses custom path seeds from env', () => {
    const paths = parseExtraPathSeeds({ BRAND_SCANNER_PATH_SEEDS: 'offers, /custom' });
    expect(paths).toEqual(['/offers', '/custom']);
  });

  it('includes common sitemap locations', () => {
    const urls = buildSitemapSeedUrls('https://shop.test/');
    expect(urls).toContain('https://shop.test/sitemap.xml');
    expect(urls).toContain('https://shop.test/wp-sitemap.xml');
  });

  it('detects catalog-like paths', () => {
    expect(isCatalogLikePath('/en/products/widget')).toBe(true);
    expect(isCatalogLikePath('/منتجات/العاب')).toBe(true);
    expect(isCatalogLikePath('/about-us')).toBe(false);
  });

  it('detects product-like and low-value paths', () => {
    expect(isProductLikePathname('/ar/shop')).toBe(true);
    expect(isProductLikePathname('/privacy-policy')).toBe(false);
    expect(isLowValueCrawlPath('/en/blog/post-1')).toBe(true);
    expect(isLowValueCrawlPath('/ar/contact')).toBe(false);
  });

  it('includes Arabic marketing seeds', () => {
    const urls = buildMarketingSeedUrls('https://brand.test').map((u) => decodeURIComponent(u));
    expect(urls.some((u) => u.endsWith('/منتجات'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/خدمات'))).toBe(true);
  });

  it('disables marketing seeds when env off', () => {
    expect(buildMarketingSeedUrls('https://brand.test', { BRAND_SCANNER_MARKETING_SEEDS: 'off' })).toEqual(
      [],
    );
    expect(isMarketingSeedPathname('/products', { BRAND_SCANNER_MARKETING_SEEDS: 'off' })).toBe(false);
    expect(isMarketingSeedPathname('/products')).toBe(true);
  });

  it('matches percent-encoded Arabic marketing seed paths', () => {
    expect(isMarketingSeedPathname('/%D8%B9%D8%B1%D9%88%D8%B6')).toBe(true);
    expect(isMarketingSeedPathname('/%D9%85%D9%86%D8%AA%D8%AC%D8%A7%D8%AA')).toBe(true);
    expect(isMarketingSeedPathname('/%D8%AA%D8%B3%D9%88%D9%82')).toBe(true);
    expect(isMarketingSeedPathname('/en/fragrances')).toBe(false);
  });

  it('treats cdn-cgi as low-value crawl path', () => {
    expect(isLowValueCrawlPath('/cdn-cgi/l/email-protection')).toBe(true);
  });
});
