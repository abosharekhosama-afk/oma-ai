import { describe, expect, it } from 'vitest';
import {
  isScanProgressStalled,
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

  it('detects stale heartbeats for active scans only', () => {
    const now = 1_700_000_000_000;
    const heartbeat = new Date(now - 120_000);
    expect(isScanProgressStalled('CRAWLING', heartbeat, { nowMs: now, stallSeconds: 90 })).toBe(
      true,
    );
    expect(isScanProgressStalled('CRAWLING', new Date(now - 30_000), { nowMs: now })).toBe(false);
    expect(isScanProgressStalled('SUCCEEDED', heartbeat, { nowMs: now })).toBe(false);
    expect(isScanProgressStalled('RUNNING', heartbeat, { nowMs: now })).toBe(false);
  });
});
