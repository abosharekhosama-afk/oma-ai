export type ScanCrawlStopReason =
  | 'queue_empty'
  | 'max_pages'
  | 'deadline'
  | 'max_depth'
  | 'cancelled'
  | 'error';

/** Why the crawl loop exited (advisory for coverage JSON). */
export function inferCrawlStopReason(input: {
  queueLength: number;
  pagesFetched: number;
  maxPages: number;
  deadlineMs: number;
  nowMs?: number;
  cancelled?: boolean;
}): ScanCrawlStopReason {
  if (input.cancelled) return 'cancelled';
  const now = input.nowMs ?? Date.now();
  if (now >= input.deadlineMs) return 'deadline';
  if (input.pagesFetched >= input.maxPages) return 'max_pages';
  if (input.queueLength === 0) return 'queue_empty';
  return 'queue_empty';
}