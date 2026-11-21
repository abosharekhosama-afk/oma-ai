import { getPrisma } from '@oma/db';

export type CrawlCheckpoint = {
  visited: Set<string>;
  pagesFetched: number;
  pagesFailed: number;
  pagesSkipped: number;
  platformChecked: boolean;
  priorPageCount: number;
};

/** Rehydrate crawl counters and visited URLs from persisted discovery rows. */
export async function loadCrawlCheckpoint(scanAttemptId: string): Promise<CrawlCheckpoint> {
  const [rows, catalogRows] = await Promise.all([
    getPrisma().discoveredPage.findMany({
      where: { scanAttemptId },
      select: { canonicalHash: true, fetchStatus: true },
    }),
    getPrisma().discoveredProductService.count({ where: { scanAttemptId } }),
  ]);

  const visited = new Set(rows.map((r) => r.canonicalHash));
  let pagesFetched = 0;
  let pagesFailed = 0;
  let pagesSkipped = 0;
  for (const row of rows) {
    if (row.fetchStatus === 'FETCHED') pagesFetched += 1;
    else if (row.fetchStatus === 'FAILED') pagesFailed += 1;
    else pagesSkipped += 1;
  }

  return {
    visited,
    pagesFetched,
    pagesFailed,
    pagesSkipped,
    platformChecked: catalogRows > 0,
    priorPageCount: rows.length,
  };
}