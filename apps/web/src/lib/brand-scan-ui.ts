import type { DiscoveredPage, InsightItem, ScanDetail } from './brand-types';

export type GroupedInsight = {
  primary: InsightItem;
  duplicates: InsightItem[];
};

export function groupInsightsByFieldAndValue(insights: InsightItem[]): GroupedInsight[] {
  const order: string[] = [];
  const groups = new Map<string, InsightItem[]>();
  for (const insight of insights) {
    const text = (insight.text_value ?? '').trim();
    const key = `${insight.field_key}\0${text}`;
    if (!groups.has(key)) {
      order.push(key);
      groups.set(key, []);
    }
    groups.get(key)!.push(insight);
  }
  return order.map((key) => {
    const list = groups.get(key)!;
    return { primary: list[0]!, duplicates: list.slice(1) };
  });
}

/** Many routes return the same shell title — typical JavaScript SPA. */
export function likelySpaShell(pages: Pick<DiscoveredPage, 'title'>[]): boolean {
  if (pages.length < 4) return false;
  const titles = pages.map((p) => (p.title ?? '').trim()).filter(Boolean);
  if (titles.length < 4) return false;
  return new Set(titles).size <= 2;
}

export function scanTerminal(scan: Pick<ScanDetail, 'status'>): boolean {
  return ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(scan.status);
}

export function crawlPhaseComplete(scan: Pick<ScanDetail, 'status' | 'progress_percent'>): boolean {
  return scanTerminal(scan) || scan.progress_percent >= 100;
}
