import { describe, expect, it } from 'vitest';
import { inferCrawlStopReason } from './scan-crawl-stop';

describe('inferCrawlStopReason', () => {
  it('prefers deadline over max pages', () => {
    expect(
      inferCrawlStopReason({
        queueLength: 5,
        pagesFetched: 50,
        maxPages: 50,
        deadlineMs: 1000,
        nowMs: 2000,
      }),
    ).toBe('deadline');
  });

  it('reports max_pages when limit hit before deadline', () => {
    expect(
      inferCrawlStopReason({
        queueLength: 3,
        pagesFetched: 20,
        maxPages: 20,
        deadlineMs: 9_999_999,
        nowMs: 1000,
      }),
    ).toBe('max_pages');
  });

  it('reports queue_empty when crawl drained early', () => {
    expect(
      inferCrawlStopReason({
        queueLength: 0,
        pagesFetched: 4,
        maxPages: 50,
        deadlineMs: Number.MAX_SAFE_INTEGER,
        nowMs: 1_000,
      }),
    ).toBe('queue_empty');
  });
});
