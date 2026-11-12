import { describe, expect, it } from 'vitest';
import {
  buildMarketingSeedUrls,
  buildSitemapSeedUrls,
  isCatalogLikePath,
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
    expect(isCatalogLikePath('/about-us')).toBe(false);
  });
});
