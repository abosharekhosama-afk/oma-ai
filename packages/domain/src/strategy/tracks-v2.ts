import { z } from 'zod';
import { STRATEGY_INFO_CLASSES } from './states';

/**
 * Strategy tracks v2 (DEC-021).
 *
 * Organic: content pillars, SEO keywords with search intent, content gaps.
 * Paid: platform budget allocation, audience targeting, A/B experiments.
 *
 * These Zod schemas are the single source of truth for the API input, the AI
 * structured output contract (see `./plan-proposal.ts`),
 * and the deterministic generator. Every row carries an info class and a
 * `source` so estimates are never presented as measured data.
 */

export const STRATEGY_SEARCH_INTENTS = [
  'INFORMATIONAL',
  'NAVIGATIONAL',
  'COMMERCIAL',
  'TRANSACTIONAL',
] as const;
export type StrategySearchIntent = (typeof STRATEGY_SEARCH_INTENTS)[number];

/** Where a row (or its metrics) came from. Shown to the user as a label. */
export const STRATEGY_DATA_SOURCES = [
  'MANUAL',
  'AI_ESTIMATE',
  'DETERMINISTIC',
  'BRAND_PROFILE',
  'EXTERNAL',
  /** Sample/demo data (fixture ports). Never presented as measured. */
  'FIXTURE',
] as const;
export type StrategyDataSource = (typeof STRATEGY_DATA_SOURCES)[number];

export const STRATEGY_CONTENT_GAP_KINDS = [
  'MISSING_TOPIC',
  'THIN_CONTENT',
  'MISSING_FORMAT',
  'FUNNEL_STAGE',
  'COMPETITOR_ONLY',
] as const;
export type StrategyContentGapKind = (typeof STRATEGY_CONTENT_GAP_KINDS)[number];

export const STRATEGY_FUNNEL_STAGES = [
  'AWARENESS',
  'CONSIDERATION',
  'CONVERSION',
  'RETENTION',
] as const;
export type StrategyFunnelStage = (typeof STRATEGY_FUNNEL_STAGES)[number];

export const STRATEGY_PAID_PLATFORMS = [
  'META',
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'SNAPCHAT',
  'X',
  'LINKEDIN',
  'YOUTUBE',
  'GOOGLE_SEARCH',
] as const;
export type StrategyPaidPlatform = (typeof STRATEGY_PAID_PLATFORMS)[number];

export const STRATEGY_PAID_OBJECTIVES = [
  'AWARENESS',
  'TRAFFIC',
  'ENGAGEMENT',
  'LEADS',
  'APP_PROMOTION',
  'SALES',
] as const;
export type StrategyPaidObjective = (typeof STRATEGY_PAID_OBJECTIVES)[number];

export const STRATEGY_EXPERIMENT_VARIABLES = [
  'CREATIVE',
  'COPY',
  'AUDIENCE',
  'PLACEMENT',
  'OFFER',
  'LANDING_PAGE',
] as const;
export type StrategyExperimentVariable = (typeof STRATEGY_EXPERIMENT_VARIABLES)[number];

export const STRATEGY_EXPERIMENT_STATUSES = [
  'PLANNED',
  'RUNNING',
  'CONCLUDED',
  'CANCELLED',
] as const;
export type StrategyExperimentStatus = (typeof STRATEGY_EXPERIMENT_STATUSES)[number];

export const STRATEGY_PLAN_LIMITS = {
  pillars: 8,
  seoKeywords: 60,
  contentGaps: 30,
  allocations: 12,
  audiences: 12,
  experiments: 10,
  variants: 5,
} as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish();
const infoClass = z.enum(STRATEGY_INFO_CLASSES);
const source = z.enum(STRATEGY_DATA_SOURCES);
const evidenceRefs = z.array(z.string().trim().min(1).max(120)).max(20).default([]);
const pillarKey = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'pillar key must be a lowercase slug');
const locale = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'locale must look like "ar" or "en-US"');

export const contentPillarInputSchema = z.strictObject({
  key: pillarKey,
  name_en: text(120),
  name_ar: text(120),
  description: optionalText(600),
  funnel_stage: z.enum(STRATEGY_FUNNEL_STAGES).nullish(),
  share_target_pct: z.number().int().min(0).max(100).nullish(),
  info_class: infoClass.default('USER_AUTHORED'),
  source: source.default('MANUAL'),
  evidence_refs: evidenceRefs,
});

export const seoKeywordInputSchema = z.strictObject({
  keyword: text(120),
  locale: locale.default('ar'),
  intent: z.enum(STRATEGY_SEARCH_INTENTS),
  pillar_key: pillarKey.nullish(),
  priority: z.number().int().min(1).max(5).default(3),
  monthly_volume: z.number().int().min(0).max(100_000_000).nullish(),
  difficulty: z.number().int().min(0).max(100).nullish(),
  /** Source of `monthly_volume` / `difficulty`; required when either metric is set. */
  metric_source: source.nullish(),
  /** Search Console performance for this query (own site), never a market volume. */
  gsc_impressions: z.number().int().min(0).max(1_000_000_000).nullish(),
  gsc_clicks: z.number().int().min(0).max(1_000_000_000).nullish(),
  gsc_position: z.number().min(0).max(1000).nullish(),
  info_class: infoClass.default('USER_AUTHORED'),
  source: source.default('MANUAL'),
  evidence_refs: evidenceRefs,
});

export const contentGapInputSchema = z.strictObject({
  kind: z.enum(STRATEGY_CONTENT_GAP_KINDS),
  topic: text(160),
  description: optionalText(600),
  pillar_key: pillarKey.nullish(),
  priority: z.number().int().min(1).max(5).default(3),
  info_class: infoClass.default('USER_AUTHORED'),
  source: source.default('MANUAL'),
  evidence_refs: evidenceRefs,
});

export const organicPlanInputSchema = z.strictObject({
  pillars: z.array(contentPillarInputSchema).max(STRATEGY_PLAN_LIMITS.pillars).default([]),
  seo_keywords: z.array(seoKeywordInputSchema).max(STRATEGY_PLAN_LIMITS.seoKeywords).default([]),
  content_gaps: z.array(contentGapInputSchema).max(STRATEGY_PLAN_LIMITS.contentGaps).default([]),
});

export const paidAllocationInputSchema = z.strictObject({
  platform: z.enum(STRATEGY_PAID_PLATFORMS),
  objective: z.enum(STRATEGY_PAID_OBJECTIVES),
  share_pct: z.number().int().min(0).max(100),
  funnel_stage: z.enum(STRATEGY_FUNNEL_STAGES).nullish(),
  rationale: optionalText(600),
  info_class: infoClass.default('USER_AUTHORED'),
  source: source.default('MANUAL'),
  evidence_refs: evidenceRefs,
});

export const paidTargetingSchema = z.strictObject({
  locations: z.array(text(80)).max(20).default([]),
  languages: z.array(locale).max(10).default([]),
  age_min: z.number().int().min(13).max(65).nullish(),
  age_max: z.number().int().min(13).max(65).nullish(),
  genders: z
    .array(z.enum(['ALL', 'FEMALE', 'MALE']))
    .max(3)
    .default([]),
  interests: z.array(text(80)).max(30).default([]),
  behaviors: z.array(text(80)).max(20).default([]),
  exclusions: z.array(text(80)).max(20).default([]),
});

export const paidAudienceInputSchema = z.strictObject({
  key: pillarKey,
  name: text(120),
  description: optionalText(600),
  platform: z.enum(STRATEGY_PAID_PLATFORMS).nullish(),
  funnel_stage: z.enum(STRATEGY_FUNNEL_STAGES).nullish(),
  targeting: paidTargetingSchema.default({
    locations: [],
    languages: [],
    genders: [],
    interests: [],
    behaviors: [],
    exclusions: [],
  }),
  info_class: infoClass.default('USER_AUTHORED'),
  source: source.default('MANUAL'),
  evidence_refs: evidenceRefs,
});

export const experimentVariantSchema = z.strictObject({
  key: z
    .string()
    .trim()
    .regex(/^[A-Z]$/, 'variant key must be a single letter A–Z'),
  description: text(400),
});

export const experimentInputSchema = z.strictObject({
  name: text(120),
  hypothesis: text(600),
  variable: z.enum(STRATEGY_EXPERIMENT_VARIABLES),
  platform: z.enum(STRATEGY_PAID_PLATFORMS).nullish(),
  audience_key: pillarKey.nullish(),
  variants: z.array(experimentVariantSchema).min(2).max(STRATEGY_PLAN_LIMITS.variants),
  primary_metric: text(80),
  min_sample_size: z.number().int().min(1).max(100_000_000).nullish(),
  duration_days: z.number().int().min(1).max(90).nullish(),
  status: z.enum(STRATEGY_EXPERIMENT_STATUSES).default('PLANNED'),
  info_class: infoClass.default('USER_AUTHORED'),
  source: source.default('MANUAL'),
  evidence_refs: evidenceRefs,
});

export const paidPlanInputSchema = z.strictObject({
  allocations: z.array(paidAllocationInputSchema).max(STRATEGY_PLAN_LIMITS.allocations).default([]),
  audiences: z.array(paidAudienceInputSchema).max(STRATEGY_PLAN_LIMITS.audiences).default([]),
  experiments: z.array(experimentInputSchema).max(STRATEGY_PLAN_LIMITS.experiments).default([]),
});

export type ContentPillarInput = z.infer<typeof contentPillarInputSchema>;
export type SeoKeywordInput = z.infer<typeof seoKeywordInputSchema>;
export type ContentGapInput = z.infer<typeof contentGapInputSchema>;
export type OrganicPlanInput = z.infer<typeof organicPlanInputSchema>;
export type PaidAllocationInput = z.infer<typeof paidAllocationInputSchema>;
export type PaidAudienceInput = z.infer<typeof paidAudienceInputSchema>;
export type ExperimentInput = z.infer<typeof experimentInputSchema>;
export type PaidPlanInput = z.infer<typeof paidPlanInputSchema>;

export type PlanIssue = { path: string; code: string; message: string };

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) dup.add(v);
    seen.add(v);
  }
  return [...dup];
}

/** Cross-row invariants for the organic plan (schema-level checks happen in Zod). */
export function organicPlanIssues(plan: OrganicPlanInput): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const keys = plan.pillars.map((p) => p.key);
  for (const key of duplicates(keys)) {
    issues.push({ path: 'pillars', code: 'DUPLICATE_PILLAR_KEY', message: `Duplicate key ${key}` });
  }
  const shareTotal = plan.pillars.reduce((sum, p) => sum + (p.share_target_pct ?? 0), 0);
  if (shareTotal > 100) {
    issues.push({
      path: 'pillars',
      code: 'PILLAR_SHARE_OVER_100',
      message: `Pillar share targets add up to ${shareTotal}%`,
    });
  }
  const known = new Set(keys);
  plan.seo_keywords.forEach((k, i) => {
    if (k.pillar_key && !known.has(k.pillar_key)) {
      issues.push({
        path: `seo_keywords.${i}.pillar_key`,
        code: 'UNKNOWN_PILLAR',
        message: `Unknown pillar ${k.pillar_key}`,
      });
    }
    if ((k.monthly_volume != null || k.difficulty != null) && !k.metric_source) {
      issues.push({
        path: `seo_keywords.${i}.metric_source`,
        code: 'METRIC_SOURCE_REQUIRED',
        message: 'Keyword metrics need a labelled source',
      });
    }
  });
  const keywordKeys = plan.seo_keywords.map((k) => `${k.locale}:${k.keyword.toLowerCase()}`);
  for (const dup of duplicates(keywordKeys)) {
    issues.push({ path: 'seo_keywords', code: 'DUPLICATE_KEYWORD', message: `Duplicate ${dup}` });
  }
  plan.content_gaps.forEach((g, i) => {
    if (g.pillar_key && !known.has(g.pillar_key)) {
      issues.push({
        path: `content_gaps.${i}.pillar_key`,
        code: 'UNKNOWN_PILLAR',
        message: `Unknown pillar ${g.pillar_key}`,
      });
    }
  });
  return issues;
}

/** Cross-row invariants for the paid plan. */
export function paidPlanIssues(plan: PaidPlanInput): PlanIssue[] {
  const issues: PlanIssue[] = [];
  if (plan.allocations.length > 0) {
    const total = plan.allocations.reduce((sum, a) => sum + a.share_pct, 0);
    if (total !== 100) {
      issues.push({
        path: 'allocations',
        code: 'ALLOCATION_NOT_100',
        message: `Budget shares add up to ${total}%, expected 100%`,
      });
    }
  }
  const pairs = plan.allocations.map((a) => `${a.platform}:${a.objective}`);
  for (const dup of duplicates(pairs)) {
    issues.push({ path: 'allocations', code: 'DUPLICATE_ALLOCATION', message: `Duplicate ${dup}` });
  }
  const audienceKeys = plan.audiences.map((a) => a.key);
  for (const dup of duplicates(audienceKeys)) {
    issues.push({ path: 'audiences', code: 'DUPLICATE_AUDIENCE_KEY', message: `Duplicate ${dup}` });
  }
  plan.audiences.forEach((a, i) => {
    const { age_min: min, age_max: max } = a.targeting;
    if (min != null && max != null && min > max) {
      issues.push({
        path: `audiences.${i}.targeting`,
        code: 'AGE_RANGE_INVALID',
        message: 'age_min must not exceed age_max',
      });
    }
  });
  const knownAudiences = new Set(audienceKeys);
  plan.experiments.forEach((e, i) => {
    const variantKeys = e.variants.map((v) => v.key);
    if (duplicates(variantKeys).length > 0) {
      issues.push({
        path: `experiments.${i}.variants`,
        code: 'DUPLICATE_VARIANT',
        message: 'Variant keys must be unique',
      });
    }
    if (e.audience_key && !knownAudiences.has(e.audience_key)) {
      issues.push({
        path: `experiments.${i}.audience_key`,
        code: 'UNKNOWN_AUDIENCE',
        message: `Unknown audience ${e.audience_key}`,
      });
    }
  });
  return issues;
}

/** Split a total budget by allocation shares (largest remainder, cents precision). */
export function allocateBudget(totalAmount: number, shares: readonly number[]): number[] {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0 || shares.length === 0) {
    return shares.map(() => 0);
  }
  const cents = Math.round(totalAmount * 100);
  const raw = shares.map((s) => (cents * s) / 100);
  const floors = raw.map((r) => Math.floor(r));
  let remainder = cents - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i]! += 1;
    remainder -= 1;
  }
  return floors.map((c) => c / 100);
}
