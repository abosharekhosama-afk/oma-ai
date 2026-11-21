import type { ContentGapInput, OrganicPlanInput, SeoKeywordInput } from '../strategy/tracks-v2';
import { STRATEGY_PLAN_LIMITS } from '../strategy/tracks-v2';
import type { StrategyContentGapKind, StrategySearchIntent } from '../strategy/tracks-v2';

export type SeoFindingForBridge = {
  page_url: string | null;
  code: string;
  severity: string;
  detail?: string | null;
};

export type GscQueryForBridge = {
  keyword: string;
  locale?: string;
  position?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  page_url?: string | null;
  source: string;
};

export type KeywordMetricForBridge = {
  keyword: string;
  locale: string;
  monthly_volume?: number | null;
  difficulty?: number | null;
  source: string;
};

export type SeoStrategyContext = {
  scan_attempt_id: string | null;
  audit_score: number | null;
  audit_created_at: string | null;
  gsc_source: string | null;
  gsc_last_sync_at: string | null;
  findings_count: number;
  queries_count: number;
};

export type SeoStrategyProposalKeyword = SeoKeywordInput & {
  proposal_id: string;
  origin: 'gsc' | 'research';
};

export type SeoStrategyProposalGap = ContentGapInput & {
  proposal_id: string;
  origin: 'crawl_finding';
  finding_code: string;
  page_url: string | null;
};

export type SeoStrategyProposalPackage = {
  context: SeoStrategyContext;
  seo_keywords: SeoStrategyProposalKeyword[];
  content_gaps: SeoStrategyProposalGap[];
};

const GAP_BY_FINDING: Partial<Record<string, StrategyContentGapKind>> = {
  SEO_THIN_CONTENT: 'THIN_CONTENT',
  SEO_PRODUCT_NO_DESCRIPTION: 'THIN_CONTENT',
  SEO_META_DESC_MISSING: 'MISSING_TOPIC',
  SEO_META_DESC_SHORT: 'MISSING_TOPIC',
  SEO_TITLE_MISSING: 'MISSING_TOPIC',
  SEO_TITLE_SHORT: 'MISSING_TOPIC',
  SEO_TITLE_LONG: 'MISSING_TOPIC',
  SEO_H1_MISSING: 'MISSING_FORMAT',
  SEO_CANONICAL_MISSING: 'MISSING_FORMAT',
  SEO_NOINDEX: 'FUNNEL_STAGE',
  SEO_DUPLICATE_TITLE: 'COMPETITOR_ONLY',
  SEO_HTTP_ERROR: 'MISSING_TOPIC',
};

function normKeyword(value: string) {
  return value.trim().toLowerCase();
}

function pageLabel(pageUrl: string | null | undefined): string {
  if (!pageUrl) return 'Site page';
  try {
    const u = new URL(pageUrl);
    const path = u.pathname === '/' ? u.hostname : u.pathname;
    return path.length > 140 ? `${path.slice(0, 137)}…` : path;
  } catch {
    const t = pageUrl.trim();
    return t.length > 140 ? `${t.slice(0, 137)}…` : t;
  }
}

function findingTopic(finding: SeoFindingForBridge): string {
  const base = pageLabel(finding.page_url);
  switch (finding.code) {
    case 'SEO_META_DESC_MISSING':
    case 'SEO_META_DESC_SHORT':
      return `Meta description · ${base}`;
    case 'SEO_TITLE_MISSING':
    case 'SEO_TITLE_SHORT':
    case 'SEO_TITLE_LONG':
      return `Title tag · ${base}`;
    case 'SEO_H1_MISSING':
      return `H1 heading · ${base}`;
    case 'SEO_THIN_CONTENT':
      return `Thin body copy · ${base}`;
    case 'SEO_PRODUCT_NO_DESCRIPTION':
      return `Product description · ${base}`;
    case 'SEO_NOINDEX':
      return `Indexed for search · ${base}`;
    case 'SEO_DUPLICATE_TITLE':
      return `Unique title · ${base}`;
    default:
      return `${finding.code.replace(/^SEO_/, '').replace(/_/g, ' ')} · ${base}`;
  }
}

function findingPriority(severity: string): number {
  if (severity === 'critical') return 5;
  if (severity === 'warning') return 4;
  return 3;
}

function inferIntent(query: GscQueryForBridge): StrategySearchIntent {
  const pos = query.position ?? 100;
  const imp = query.impressions ?? 0;
  if (imp >= 500 && pos > 8) return 'COMMERCIAL';
  if (pos <= 5 && (query.clicks ?? 0) >= 10) return 'TRANSACTIONAL';
  if (pos <= 3) return 'NAVIGATIONAL';
  return 'INFORMATIONAL';
}

function evidenceScan(scanId: string | null, extra: string[]): string[] {
  const refs: string[] = [];
  if (scanId) refs.push(`seo:scan:${scanId}`);
  refs.push(...extra);
  return refs.slice(0, 20);
}

/**
 * Deterministic mapping from crawl audit + GSC (+ optional research metrics) to organic plan rows.
 * Output is always a proposal — the API/UI applies it explicitly (DEC-021 / DEC-028).
 */
export function buildSeoStrategyProposals(input: {
  scanAttemptId: string | null;
  auditScore: number | null;
  auditCreatedAt: string | null;
  gscLastSyncAt: string | null;
  findings: SeoFindingForBridge[];
  gscQueries: GscQueryForBridge[];
  researchMetrics?: KeywordMetricForBridge[];
}): SeoStrategyProposalPackage {
  const researchByKey = new Map(
    (input.researchMetrics ?? []).map((m) => [`${normKeyword(m.keyword)}:${m.locale}`, m]),
  );

  const gapSeen = new Set<string>();
  const content_gaps: SeoStrategyProposalGap[] = [];
  for (const f of input.findings) {
    const kind = GAP_BY_FINDING[f.code];
    if (!kind) continue;
    const topic = findingTopic(f);
    const dedupe = `${kind}:${topic.toLowerCase()}`;
    if (gapSeen.has(dedupe)) continue;
    gapSeen.add(dedupe);
    const page = f.page_url ?? null;
    const proposal_id = `gap:${f.code}:${page ?? 'site'}`;
    content_gaps.push({
      proposal_id,
      origin: 'crawl_finding',
      finding_code: f.code,
      page_url: page,
      kind,
      topic,
      description: f.detail?.trim() ? f.detail.trim().slice(0, 600) : null,
      pillar_key: null,
      priority: findingPriority(f.severity),
      info_class: 'USER_AUTHORED',
      source: 'DETERMINISTIC',
      evidence_refs: evidenceScan(input.scanAttemptId, [
        `seo:finding:${f.code}`,
        ...(page ? [`seo:page:${page}`] : []),
      ]),
    });
    if (content_gaps.length >= STRATEGY_PLAN_LIMITS.contentGaps) break;
  }

  const kwSeen = new Set<string>();
  const seo_keywords: SeoStrategyProposalKeyword[] = [];
  const sortedQueries = [...input.gscQueries].sort(
    (a, b) => (b.impressions ?? 0) - (a.impressions ?? 0),
  );
  for (const q of sortedQueries) {
    const keyword = q.keyword.trim();
    if (!keyword) continue;
    const locale = q.locale?.trim() || 'ar';
    const key = normKeyword(keyword);
    if (kwSeen.has(key)) continue;
    kwSeen.add(key);
    const research = researchByKey.get(`${key}:${locale}`);
    const impressions = q.impressions ?? null;
    const proposal_id = `kw:gsc:${key}`;
    seo_keywords.push({
      proposal_id,
      origin: 'gsc',
      keyword,
      locale,
      intent: inferIntent(q),
      pillar_key: null,
      priority: impressions != null && impressions >= 1000 ? 4 : 3,
      monthly_volume: research?.monthly_volume ?? impressions,
      difficulty: research?.difficulty ?? null,
      metric_source:
        research?.monthly_volume != null || research?.difficulty != null
          ? 'EXTERNAL'
          : impressions != null
            ? 'EXTERNAL'
            : null,
      info_class: 'USER_AUTHORED',
      source: 'EXTERNAL',
      evidence_refs: evidenceScan(input.scanAttemptId, [
        `gsc:query:${keyword}`,
        ...(q.page_url ? [`gsc:page:${q.page_url}`] : []),
      ]),
    });
    if (seo_keywords.length >= STRATEGY_PLAN_LIMITS.seoKeywords) break;
  }

  return {
    context: {
      scan_attempt_id: input.scanAttemptId,
      audit_score: input.auditScore,
      audit_created_at: input.auditCreatedAt,
      findings_count: input.findings.length,
      queries_count: input.gscQueries.length,
      gsc_source: input.gscQueries[0]?.source ?? null,
      gsc_last_sync_at: input.gscLastSyncAt,
    },
    seo_keywords,
    content_gaps,
  };
}

export function mergeSeoProposalsIntoOrganicPlan(
  current: OrganicPlanInput,
  additions: {
    seo_keywords?: SeoKeywordInput[];
    content_gaps?: ContentGapInput[];
  },
): OrganicPlanInput {
  const existingKw = new Set(current.seo_keywords.map((k) => normKeyword(k.keyword)));
  const existingGap = new Set(
    current.content_gaps.map((g) => `${g.kind}:${g.topic.trim().toLowerCase()}`),
  );

  const seo_keywords = [...current.seo_keywords];
  for (const row of additions.seo_keywords ?? []) {
    const key = normKeyword(row.keyword);
    if (!key || existingKw.has(key)) continue;
    if (seo_keywords.length >= STRATEGY_PLAN_LIMITS.seoKeywords) break;
    existingKw.add(key);
    seo_keywords.push(row);
  }

  const content_gaps = [...current.content_gaps];
  for (const row of additions.content_gaps ?? []) {
    const dedupe = `${row.kind}:${row.topic.trim().toLowerCase()}`;
    if (existingGap.has(dedupe)) continue;
    if (content_gaps.length >= STRATEGY_PLAN_LIMITS.contentGaps) break;
    existingGap.add(dedupe);
    content_gaps.push(row);
  }

  return {
    pillars: current.pillars,
    seo_keywords,
    content_gaps,
  };
}

export function pickSeoProposalsById(
  pkg: SeoStrategyProposalPackage,
  proposalIds: string[],
): { seo_keywords: SeoKeywordInput[]; content_gaps: ContentGapInput[] } {
  const wanted = new Set(proposalIds);
  const seo_keywords: SeoKeywordInput[] = [];
  for (const row of pkg.seo_keywords) {
    if (!wanted.has(row.proposal_id)) continue;
    const { proposal_id: _id, origin: _o, ...rest } = row;
    seo_keywords.push(rest);
  }
  const content_gaps: ContentGapInput[] = [];
  for (const row of pkg.content_gaps) {
    if (!wanted.has(row.proposal_id)) continue;
    const { proposal_id: _id, origin: _o, finding_code: _c, page_url: _p, ...rest } = row;
    content_gaps.push(rest);
  }
  return { seo_keywords, content_gaps };
}
