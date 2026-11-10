import { describe, expect, it } from 'vitest';
import { parseSitemapXml } from './sitemap-parser';

describe('sitemap-parser', () => {
  it('parses a urlset', () => {
    const parsed = parseSitemapXml(`
<?xml version="1.0"?>
<urlset>
  <url><loc>https://example.test/about</loc></url>
  <url><loc>https://example.test/contact</loc></url>
</urlset>`);
    expect(parsed.kind).toBe('urlset');
    expect(parsed.urls).toEqual(['https://example.test/about', 'https://example.test/contact']);
  });

  it('parses a sitemap index and decodes entities', () => {
    const parsed = parseSitemapXml(`
<sitemapindex>
  <sitemap><loc>https://example.test/site.xml?a=1&amp;b=2</loc></sitemap>
</sitemapindex>`);
    expect(parsed.kind).toBe('index');
    expect(parsed.sitemaps).toEqual(['https://example.test/site.xml?a=1&b=2']);
  });
});
