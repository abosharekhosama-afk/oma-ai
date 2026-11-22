import { api } from './api';

/** Mirrors the tracks-v2 API (`GET …/versions/:versionId/plan`). */
export type PlanSource =
  'MANUAL' | 'AI_ESTIMATE' | 'DETERMINISTIC' | 'BRAND_PROFILE' | 'EXTERNAL' | 'FIXTURE';

export type PlanRowMeta = {
  info_class?: string;
  source?: PlanSource;
  evidence_refs?: string[];
};

export type PillarRow = PlanRowMeta & {
  key: string;
  name_en: string;
  name_ar: string;
  description?: string | null;
  funnel_stage?: string | null;
  share_target_pct?: number | null;
};

export type KeywordRow = PlanRowMeta & {
  keyword: string;
  locale: string;
  intent: string;
  pillar_key?: string | null;
  priority?: number;
  monthly_volume?: number | null;
  difficulty?: number | null;
  metric_source?: PlanSource | null;
  /** Own-site Search Console performance (not market volume). */
  gsc_impressions?: number | null;
  gsc_clicks?: number | null;
  gsc_position?: number | null;
};

export type GapRow = PlanRowMeta & {
  kind: string;
  topic: string;
  description?: string | null;
  pillar_key?: string | null;
  priority?: number;
};

export type AllocationRow = PlanRowMeta & {
  platform: string;
  objective: string;
  share_pct: number;
  funnel_stage?: string | null;
  rationale?: string | null;
  amount?: string | null;
};

export type AudienceRow = PlanRowMeta & {
  key: string;
  name: string;
  description?: string | null;
  platform?: string | null;
  funnel_stage?: string | null;
  targeting: {
    locations: string[];
    languages: string[];
    age_min?: number | null;
    age_max?: number | null;
    genders?: string[];
    interests: string[];
    behaviors?: string[];
    exclusions?: string[];
  };
};

export type ExperimentRow = PlanRowMeta & {
  name: string;
  hypothesis: string;
  variable: string;
  platform?: string | null;
  audience_key?: string | null;
  variants: Array<{ key: string; description: string }>;
  primary_metric: string;
  min_sample_size?: number | null;
  duration_days?: number | null;
  status?: string;
};

export type CadenceRow = {
  channel: string;
  posts_per_week: number;
  formats: string[];
  info_class?: string;
  source?: PlanSource;
};

export type OrganicPlan = {
  cadence?: CadenceRow[];
  pillars: PillarRow[];
  seo_keywords: KeywordRow[];
  content_gaps: GapRow[];
};
/** DEC-029 4.7: a paid campaign flight (dates + planned budget). */
export type FlightRow = {
  key: string;
  name: string;
  platform: string;
  objective?: string | null;
  audience_key?: string | null;
  start_date: string;
  end_date: string;
  budget_amount?: number | null;
  currency?: string | null;
  notes?: string | null;
};

export type PaidPlan = {
  allocations: AllocationRow[];
  audiences: AudienceRow[];
  experiments: ExperimentRow[];
  /** Omitted = keep stored flights. */
  flights?: FlightRow[];
};

export type StrategyPlan = {
  strategy_version_id: string;
  status: string;
  row_version: number;
  editable: boolean;
  organic_enabled: boolean;
  paid_enabled: boolean;
  organic: OrganicPlan;
  paid: PaidPlan & {
    budget_amount: string | null;
    budget_currency: string | null;
    allocation_total_pct: number;
  };
  ai_run_ids: string[];
  research: { mode: 'manual' | 'ai_estimate'; measured: false };
};

export type PlanProposal = {
  mode: 'ai' | 'template';
  run_id: string | null;
  tracks: Array<'organic' | 'paid'>;
  rationale: string;
  requires_acceptance: true;
  auto_approved: false;
  proposal: { organic: OrganicPlan | null; paid: PaidPlan | null };
};

export const SEARCH_INTENTS = ['INFORMATIONAL', 'NAVIGATIONAL', 'COMMERCIAL', 'TRANSACTIONAL'];
export const GAP_KINDS = [
  'MISSING_TOPIC',
  'THIN_CONTENT',
  'MISSING_FORMAT',
  'FUNNEL_STAGE',
  'COMPETITOR_ONLY',
];
export const PAID_PLATFORMS = [
  'META',
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'SNAPCHAT',
  'X',
  'LINKEDIN',
  'YOUTUBE',
  'GOOGLE_SEARCH',
];
export const PAID_OBJECTIVES = [
  'AWARENESS',
  'TRAFFIC',
  'ENGAGEMENT',
  'LEADS',
  'APP_PROMOTION',
  'SALES',
];
export const EXPERIMENT_VARIABLES = [
  'CREATIVE',
  'COPY',
  'AUDIENCE',
  'PLACEMENT',
  'OFFER',
  'LANDING_PAGE',
];

/** i18n key for a row's provenance badge. Estimates are never labelled as measured. */
export function planSourceLabelKey(source: PlanSource | null | undefined): string {
  switch (source) {
    case 'AI_ESTIMATE':
      return 'strategy.plan.source.aiEstimate';
    case 'DETERMINISTIC':
      return 'strategy.plan.source.template';
    case 'BRAND_PROFILE':
      return 'strategy.plan.source.brandProfile';
    case 'EXTERNAL':
      return 'strategy.plan.source.external';
    case 'FIXTURE':
      return 'strategy.plan.source.fixture';
    default:
      return 'strategy.plan.source.manual';
  }
}

export function allocationTotal(rows: ReadonlyArray<{ share_pct: number }>): number {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.share_pct) ? r.share_pct : 0), 0);
}

export function pillarShareTotal(
  rows: ReadonlyArray<{ share_target_pct?: number | null }>,
): number {
  return rows.reduce((sum, r) => sum + (r.share_target_pct ?? 0), 0);
}

/** Lowercase slug for row keys (pillars, audiences); keeps Arabic-only names usable. */
export function slugifyKey(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

/** Strip server-computed fields before sending a track back (PUT replaces the track). */
export function organicPayload(plan: OrganicPlan) {
  return {
    ...(plan.cadence ? { cadence: plan.cadence } : {}),
    pillars: plan.pillars,
    seo_keywords: plan.seo_keywords,
    content_gaps: plan.content_gaps,
  };
}

export function paidPayload(plan: PaidPlan) {
  return {
    allocations: plan.allocations.map(({ amount: _amount, ...row }) => row),
    audiences: plan.audiences,
    experiments: plan.experiments,
    ...(plan.flights ? { flights: plan.flights } : {}),
  };
}

/** Client-side mirror of the paid invariant so Save is blocked before a 400. */
export function paidPlanWarnings(plan: PaidPlan): string[] {
  const warnings: string[] = [];
  if (plan.allocations.length > 0 && allocationTotal(plan.allocations) !== 100) {
    warnings.push('strategy.plan.warn.allocationTotal');
  }
  if (plan.experiments.some((e) => e.variants.length < 2)) {
    warnings.push('strategy.plan.warn.variants');
  }
  if ((plan.flights ?? []).some((f) => !f.start_date || !f.end_date || f.end_date < f.start_date)) {
    warnings.push('strategy.plan.warn.flightDates');
  }
  return warnings;
}

export function organicPlanWarnings(plan: OrganicPlan): string[] {
  const warnings: string[] = [];
  if (pillarShareTotal(plan.pillars) > 100) warnings.push('strategy.plan.warn.pillarShare');
  const keys = plan.pillars.map((p) => p.key);
  if (new Set(keys).size !== keys.length) warnings.push('strategy.plan.warn.duplicateKey');
  const channels = (plan.cadence ?? []).map((c) => c.channel.trim().toLowerCase());
  if (new Set(channels).size !== channels.length) {
    warnings.push('strategy.plan.warn.duplicateChannel');
  }
  if ((plan.cadence ?? []).some((c) => !c.channel.trim())) {
    warnings.push('strategy.plan.warn.cadenceChannel');
  }
  return warnings;
}

function base(brandId: string, strategyId: string, versionId: string) {
  return `/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan`;
}

export function getStrategyPlan(brandId: string, strategyId: string, versionId: string) {
  return api<{ data: StrategyPlan }>(base(brandId, strategyId, versionId));
}

export function putOrganicPlan(
  brandId: string,
  strategyId: string,
  versionId: string,
  rowVersion: number,
  plan: OrganicPlan,
) {
  return api<{ data: StrategyPlan }>(`${base(brandId, strategyId, versionId)}/organic`, {
    method: 'PUT',
    body: JSON.stringify({ row_version: rowVersion, ...organicPayload(plan) }),
  });
}

export function putPaidPlan(
  brandId: string,
  strategyId: string,
  versionId: string,
  rowVersion: number,
  plan: PaidPlan,
  budget?: { amount: string; currency: string },
) {
  return api<{ data: StrategyPlan }>(`${base(brandId, strategyId, versionId)}/paid`, {
    method: 'PUT',
    body: JSON.stringify({
      row_version: rowVersion,
      ...paidPayload(plan),
      budget_amount: budget?.amount.trim() ? budget.amount.trim() : null,
      budget_currency: budget?.currency?.trim() || 'USD',
    }),
  });
}

export function proposeStrategyPlan(
  brandId: string,
  strategyId: string,
  versionId: string,
  body: { mode: 'ai' | 'template'; tracks?: Array<'organic' | 'paid'> },
) {
  return api<{ data: PlanProposal }>(`${base(brandId, strategyId, versionId)}/ai/propose`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function acceptStrategyPlanProposal(
  brandId: string,
  strategyId: string,
  versionId: string,
  body: { run_id: string; row_version: number; tracks?: Array<'organic' | 'paid'> },
) {
  return api<{ data: StrategyPlan }>(`${base(brandId, strategyId, versionId)}/ai/accept`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
