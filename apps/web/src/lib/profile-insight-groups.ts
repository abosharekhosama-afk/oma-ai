import type { InsightItem } from './brand-types';
import { insightPayload } from './profile-display';

export type EvidenceInsightBundle = {
  evidenceId: string | null;
  insights: InsightItem[];
};

const BUNDLE_FIELD_ORDER = [
  'brand.name',
  'brand.source_url',
  'brand.description',
  'brand.social',
  'brand.logo',
  'brand.colors',
  'brand.contact',
  'brand.languages',
  'brand.categories',
  'brand.tone',
  'brand.messaging',
];

function insightRank(fieldKey: string): number {
  const i = BUNDLE_FIELD_ORDER.indexOf(fieldKey);
  return i >= 0 ? i : 100 + fieldKey.localeCompare('');
}

export function sortInsightsForBundle(insights: InsightItem[]): InsightItem[] {
  return [...insights].sort((a, b) => insightRank(a.field_key) - insightRank(b.field_key));
}

/** Group per-page crawl observations (shared evidence) into one card. */
export function groupInsightsByEvidence(insights: InsightItem[]): {
  bundles: EvidenceInsightBundle[];
  singletons: InsightItem[];
} {
  const byEvidence = new Map<string, InsightItem[]>();
  const singletons: InsightItem[] = [];

  for (const insight of insights) {
    const eid = insight.evidence_id;
    if (!eid) {
      singletons.push(insight);
      continue;
    }
    const list = byEvidence.get(eid) ?? [];
    list.push(insight);
    byEvidence.set(eid, list);
  }

  const bundles: EvidenceInsightBundle[] = [];
  for (const [evidenceId, group] of byEvidence) {
    if (group.length === 1 && !group[0]!.field_key.startsWith('catalog.')) {
      singletons.push(group[0]!);
    } else {
      bundles.push({ evidenceId, insights: sortInsightsForBundle(group) });
    }
  }

  bundles.sort((a, b) => {
    const titleA = bundleTitle(a.insights) ?? '';
    const titleB = bundleTitle(b.insights) ?? '';
    return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
  });

  return { bundles, singletons };
}

export function bundleTitle(insights: InsightItem[]): string | null {
  const name = insights.find((i) => i.field_key === 'brand.name');
  if (!name) return null;
  const payload = insightPayload(name);
  if (typeof payload === 'string' && payload.trim() && !payload.startsWith('{')) {
    return payload.trim();
  }
  return null;
}

export function bundleSourceUrl(insights: InsightItem[]): string | null {
  const row = insights.find((i) => i.field_key === 'brand.source_url');
  if (!row) return null;
  const payload = insightPayload(row);
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  return null;
}