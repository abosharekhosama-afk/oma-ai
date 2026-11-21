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

const ACTIVE_SCAN_STATUSES = new Set(['QUEUED', 'CRAWLING', 'EXTRACTING', 'ANALYZING']);

/** True when an in-flight scan has not emitted a progress heartbeat within the stall window. */
export function isScanProgressStalled(
  status: string,
  heartbeatAt: Date | null | undefined,
  options?: { nowMs?: number; stallSeconds?: number },
): boolean {
  if (!ACTIVE_SCAN_STATUSES.has(status) || !heartbeatAt) return false;
  const stallSec = Math.max(30, options?.stallSeconds ?? 90);
  const now = options?.nowMs ?? Date.now();
  return now - heartbeatAt.getTime() > stallSec * 1000;
}
