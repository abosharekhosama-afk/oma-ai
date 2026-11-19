/** Maps crawl work units to a monotonic 0–96% advisory progress (100% reserved for terminal complete). */
export function scanCrawlProgressPercent(pagesFetched: number, maxPages: number): number {
  const cap = Math.max(1, maxPages);
  const ratio = Math.min(1, Math.max(0, pagesFetched / cap));
  const start = 8;
  const end = 85;
  return Math.min(96, Math.round(start + ratio * (end - start)));
}

export function scanSitemapProgressPercent(): number {
  return 5;
}

export function scanCatalogProgressPercent(): number {
  return 92;
}

export function scanPreCompleteProgressPercent(): number {
  return 96;
}
