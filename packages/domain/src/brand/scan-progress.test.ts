import { describe, expect, it } from 'vitest';
import {
  scanCatalogProgressPercent,
  scanCrawlProgressPercent,
  scanPreCompleteProgressPercent,
  scanSitemapProgressPercent,
} from './scan-progress';

describe('scan-progress', () => {
  it('ramps crawl percent with pages fetched', () => {
    expect(scanSitemapProgressPercent()).toBe(5);
    expect(scanCrawlProgressPercent(0, 50)).toBe(8);
    expect(scanCrawlProgressPercent(25, 50)).toBeGreaterThan(40);
    expect(scanCrawlProgressPercent(50, 50)).toBe(85);
    expect(scanCatalogProgressPercent()).toBe(92);
    expect(scanPreCompleteProgressPercent()).toBe(96);
  });
});
