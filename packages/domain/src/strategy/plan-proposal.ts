import { z } from 'zod';
import {
  STRATEGY_CONTENT_GAP_KINDS,
  STRATEGY_EXPERIMENT_VARIABLES,
  STRATEGY_FUNNEL_STAGES,
  STRATEGY_PAID_OBJECTIVES,
  STRATEGY_PAID_PLATFORMS,
  STRATEGY_PLAN_LIMITS,
  STRATEGY_SEARCH_INTENTS,
  organicPlanInputSchema,
  organicPlanIssues,
  paidPlanInputSchema,
  paidPlanIssues,
  type OrganicPlanInput,
  type PaidPlanInput,
  type PlanIssue,
  type StrategyDataSource,
} from './tracks-v2';

/**
 * AI structured output contract for strategy plan generation (DEC-020, DEC-021).
 *
 * The shape is "strict-mode friendly": every key is required and optional
 * values are `null`, so the JSON Schema can be passed to providers that enforce
 * strict structured outputs. The model output is a *proposal*: it is converted
 * into plan inputs tagged `AI_PROPOSAL` / `AI_ESTIMATE` and only written to a
 * DRAFT version after an explicit human accept. It never changes a version's
 * status and is never auto-approved.
 */

export const STRATEGY_PLAN_PROMPT_ID = 'oma.strategy_plan_generate';
export const STRATEGY_PLAN_PROMPT_VERSION = '1';
export const STRATEGY_PLAN_SCHEMA_VERSION = '1';

const s = (max: number) => z.string().min(1).max(max);
const slug = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9-]*$/);
const nullableText = (max: number) => z.string().max(max).nullable();
const lang = z.enum(['en', 'ar']);

const aiPillar = z.strictObject({
  key: slug,
  name_en: s(120),
  name_ar: s(120),
  description: nullableText(600),
  funnel_stage: z.enum(STRATEGY_FUNNEL_STAGES).nullable(),
  share_target_pct: z.number().int().min(0).max(100).nullable(),
});

const aiKeyword = z.strictObject({
  keyword: s(120),
  locale: lang,
  intent: z.enum(STRATEGY_SEARCH_INTENTS),
  pillar_key: slug.nullable(),
  priority: z.number().int().min(1).max(5),
  monthly_volume_estimate: z.number().int().min(0).max(100_000_000).nullable(),
  difficulty_estimate: z.number().int().min(0).max(100).nullable(),
});

const aiGap = z.strictObject({
  kind: z.enum(STRATEGY_CONTENT_GAP_KINDS),
  topic: s(160),
  description: nullableText(600),
  pillar_key: slug.nullable(),
  priority: z.number().int().min(1).max(5),
});

const aiAllocation = z.strictObject({
  platform: z.enum(STRATEGY_PAID_PLATFORMS),
  objective: z.enum(STRATEGY_PAID_OBJECTIVES),
  share_pct: z.number().int().min(0).max(100),
  funnel_stage: z.enum(STRATEGY_FUNNEL_STAGES).nullable(),
  rationale: nullableText(600),
});

const aiAudience = z.strictObject({
  key: slug,
  name: s(120),
  description: nullableText(600),
  platform: z.enum(STRATEGY_PAID_PLATFORMS).nullable(),
  funnel_stage: z.enum(STRATEGY_FUNNEL_STAGES).nullable(),
  locations: z.array(s(80)).max(20),
  languages: z.array(lang).max(2),
  age_min: z.number().int().min(13).max(65).nullable(),
  age_max: z.number().int().min(13).max(65).nullable(),
  interests: z.array(s(80)).max(30),
});

const aiExperiment = z.strictObject({
  name: s(120),
  hypothesis: s(600),
  variable: z.enum(STRATEGY_EXPERIMENT_VARIABLES),
  platform: z.enum(STRATEGY_PAID_PLATFORMS).nullable(),
  audience_key: slug.nullable(),
  variants: z
    .array(
      z.strictObject({
        key: z.string().regex(/^[A-Z]$/),
        description: s(400),
      }),
    )
    .min(2)
    .max(STRATEGY_PLAN_LIMITS.variants),
  primary_metric: s(80),
  duration_days: z.number().int().min(1).max(90).nullable(),
});

export const aiStrategyPlanProposalSchema = z.strictObject({
  schema_version: z.literal(STRATEGY_PLAN_SCHEMA_VERSION),
  language: lang,
  rationale: s(1200),
  organic: z
    .strictObject({
      pillars: z.array(aiPillar).max(STRATEGY_PLAN_LIMITS.pillars),
      seo_keywords: z.array(aiKeyword).max(STRATEGY_PLAN_LIMITS.seoKeywords),
      content_gaps: z.array(aiGap).max(STRATEGY_PLAN_LIMITS.contentGaps),
    })
    .nullable(),
  paid: z
    .strictObject({
      allocations: z.array(aiAllocation).max(STRATEGY_PLAN_LIMITS.allocations),
      audiences: z.array(aiAudience).max(STRATEGY_PLAN_LIMITS.audiences),
      experiments: z.array(aiExperiment).max(STRATEGY_PLAN_LIMITS.experiments),
    })
    .nullable(),
});

export type AiStrategyPlanProposal = z.infer<typeof aiStrategyPlanProposalSchema>;

/** Keywords strict structured-output providers reject; Zod still enforces them. */
const PROVIDER_UNSUPPORTED_KEYWORDS = new Set(['$schema', 'minLength', 'maxLength']);

function stripUnsupported(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupported);
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (PROVIDER_UNSUPPORTED_KEYWORDS.has(key)) continue;
    out[key] = key === 'properties' ? mapValues(value, stripUnsupported) : stripUnsupported(value);
  }
  return out;
}

function mapValues(value: unknown, fn: (v: unknown) => unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, fn(v)]),
  );
}

/**
 * JSON Schema handed to the provider's strict structured-output mode: every
 * object is closed and lists all of its keys as required (nullable instead of
 * optional). The model output is re-validated with the full Zod schema.
 */
export function strategyPlanProposalJsonSchema(): Record<string, unknown> {
  return stripUnsupported(z.toJSONSchema(aiStrategyPlanProposalSchema, { io: 'input' })) as Record<
    string,
    unknown
  >;
}

export type StrategyPlanTracks = { organic: boolean; paid: boolean };

export type StrategyPlanProposalInputs = {
  organic: OrganicPlanInput | null;
  paid: PaidPlanInput | null;
};

/**
 * Convert a validated model proposal into plan inputs for the enabled tracks
 * only (auto-split). Rows are tagged so the UI can always show provenance.
 */
export function proposalToPlanInputs(
  proposal: AiStrategyPlanProposal,
  tracks: StrategyPlanTracks,
  opts: {
    source: Extract<StrategyDataSource, 'AI_ESTIMATE' | 'DETERMINISTIC'>;
    evidenceRefs?: string[];
  },
): StrategyPlanProposalInputs {
  const tag = {
    info_class: 'AI_PROPOSAL' as const,
    source: opts.source,
    evidence_refs: (opts.evidenceRefs ?? []).slice(0, 20),
  };
  const organic =
    tracks.organic && proposal.organic
      ? organicPlanInputSchema.parse({
          pillars: proposal.organic.pillars.map((p) => ({ ...p, ...tag })),
          seo_keywords: proposal.organic.seo_keywords.map((k) => {
            const hasMetric = k.monthly_volume_estimate != null || k.difficulty_estimate != null;
            return {
              keyword: k.keyword,
              locale: k.locale,
              intent: k.intent,
              pillar_key: k.pillar_key,
              priority: k.priority,
              monthly_volume: k.monthly_volume_estimate,
              difficulty: k.difficulty_estimate,
              metric_source: hasMetric ? opts.source : null,
              ...tag,
            };
          }),
          content_gaps: proposal.organic.content_gaps.map((g) => ({ ...g, ...tag })),
        })
      : null;
  const paid =
    tracks.paid && proposal.paid
      ? paidPlanInputSchema.parse({
          allocations: proposal.paid.allocations.map((a) => ({ ...a, ...tag })),
          audiences: proposal.paid.audiences.map((a) => ({
            key: a.key,
            name: a.name,
            description: a.description,
            platform: a.platform,
            funnel_stage: a.funnel_stage,
            targeting: {
              locations: a.locations,
              languages: a.languages,
              age_min: a.age_min,
              age_max: a.age_max,
              interests: a.interests,
            },
            ...tag,
          })),
          experiments: proposal.paid.experiments.map((e) => ({ ...e, status: 'PLANNED', ...tag })),
        })
      : null;
  return { organic, paid };
}

export type PlanProposalCheck =
  | { ok: true; proposal: AiStrategyPlanProposal; inputs: StrategyPlanProposalInputs }
  | { ok: false; issues: PlanIssue[] };

/**
 * Validate raw model output: strict schema, then the same cross-row invariants
 * a human edit must satisfy, then "the enabled tracks are present".
 */
export function validateStrategyPlanProposal(
  raw: unknown,
  tracks: StrategyPlanTracks,
  opts: { source: 'AI_ESTIMATE' | 'DETERMINISTIC'; evidenceRefs?: string[] },
): PlanProposalCheck {
  const parsed = aiStrategyPlanProposalSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        code: 'SCHEMA',
        message: i.message,
      })),
    };
  }
  const issues: PlanIssue[] = [];
  if (tracks.organic && !parsed.data.organic) {
    issues.push({ path: 'organic', code: 'TRACK_MISSING', message: 'Organic plan is required' });
  }
  if (tracks.paid && !parsed.data.paid) {
    issues.push({ path: 'paid', code: 'TRACK_MISSING', message: 'Paid plan is required' });
  }
  if (issues.length) return { ok: false, issues };
  let inputs: StrategyPlanProposalInputs;
  try {
    inputs = proposalToPlanInputs(parsed.data, tracks, opts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        ok: false,
        issues: error.issues.map((i) => ({
          path: i.path.join('.'),
          code: 'SCHEMA',
          message: i.message,
        })),
      };
    }
    throw error;
  }
  if (inputs.organic) {
    issues.push(
      ...organicPlanIssues(inputs.organic).map((i) => ({ ...i, path: `organic.${i.path}` })),
    );
  }
  if (inputs.paid) {
    issues.push(...paidPlanIssues(inputs.paid).map((i) => ({ ...i, path: `paid.${i.path}` })));
  }
  return issues.length ? { ok: false, issues } : { ok: true, proposal: parsed.data, inputs };
}

export type DeterministicPlanContext = {
  brandName: string;
  language: 'en' | 'ar';
  products: string;
  services: string;
  audiences: string;
  tracks: StrategyPlanTracks;
};

function firstItems(raw: string, max: number): string[] {
  return raw
    .split(/\n|;|,|•|\|/)
    .map((part) => part.replace(/^[-*\d.\s]+/, '').trim())
    .filter((part) => part.length >= 2 && part.length <= 80)
    .slice(0, max);
}

/**
 * Template plan built only from approved brand-profile fields (no invented
 * metrics). Used by the test adapter and as the "start from template" path when
 * AI is unavailable. Rows are labelled DETERMINISTIC by the caller.
 */
export function deterministicStrategyPlanProposal(
  ctx: DeterministicPlanContext,
): AiStrategyPlanProposal {
  const offers = [...firstItems(ctx.products, 3), ...firstItems(ctx.services, 2)].slice(0, 3);
  const name = ctx.brandName.trim().slice(0, 80) || 'Brand';
  const locale = ctx.language;
  const audienceLabel =
    firstItems(ctx.audiences, 1)[0] ?? (locale === 'ar' ? 'الجمهور الأساسي' : 'Core audience');
  return {
    schema_version: STRATEGY_PLAN_SCHEMA_VERSION,
    language: locale,
    rationale:
      locale === 'ar'
        ? `مسودة قالب مبنية على ملف العلامة المعتمد لـ ${name}. لا تحتوي على أرقام مقاسة؛ راجعها وعدّلها قبل الاعتماد.`
        : `Template draft built from ${name}'s approved brand profile. It contains no measured metrics; review and edit before approval.`,
    organic: ctx.tracks.organic
      ? {
          pillars: [
            {
              key: 'education',
              name_en: 'Education',
              name_ar: 'التثقيف',
              description: null,
              funnel_stage: 'AWARENESS',
              share_target_pct: 40,
            },
            {
              key: 'offer',
              name_en: 'Products & services',
              name_ar: 'المنتجات والخدمات',
              description: offers.length ? offers.join(' · ') : null,
              funnel_stage: 'CONSIDERATION',
              share_target_pct: 35,
            },
            {
              key: 'community',
              name_en: 'Community & proof',
              name_ar: 'المجتمع والإثبات',
              description: null,
              funnel_stage: 'RETENTION',
              share_target_pct: 25,
            },
          ],
          seo_keywords: [name, ...offers]
            .filter((k, i, all) => all.findIndex((o) => o.toLowerCase() === k.toLowerCase()) === i)
            .slice(0, 4)
            .map((keyword, i) => ({
              keyword,
              locale,
              intent: i === 0 ? ('NAVIGATIONAL' as const) : ('COMMERCIAL' as const),
              pillar_key: i === 0 ? 'education' : 'offer',
              priority: i === 0 ? 2 : 3,
              monthly_volume_estimate: null,
              difficulty_estimate: null,
            })),
          content_gaps: [
            {
              kind: 'FUNNEL_STAGE' as const,
              topic: locale === 'ar' ? 'محتوى مرحلة التحويل' : 'Conversion-stage content',
              description: null,
              pillar_key: 'offer',
              priority: 3,
            },
          ],
        }
      : null,
    paid: ctx.tracks.paid
      ? {
          allocations: [
            {
              platform: 'INSTAGRAM',
              objective: 'AWARENESS',
              share_pct: 50,
              funnel_stage: 'AWARENESS',
              rationale: null,
            },
            {
              platform: 'META',
              objective: 'SALES',
              share_pct: 50,
              funnel_stage: 'CONVERSION',
              rationale: null,
            },
          ],
          audiences: [
            {
              key: 'core',
              name: audienceLabel,
              description: null,
              platform: null,
              funnel_stage: 'AWARENESS',
              locations: [],
              languages: [locale],
              age_min: null,
              age_max: null,
              interests: offers,
            },
          ],
          experiments: [
            {
              name: locale === 'ar' ? 'اختبار الرسالة الافتتاحية' : 'Opening hook test',
              hypothesis:
                locale === 'ar'
                  ? 'رسالة تركز على الفائدة تتفوق على رسالة تركز على المنتج'
                  : 'A benefit-led hook outperforms a product-led hook',
              variable: 'COPY',
              platform: 'INSTAGRAM',
              audience_key: 'core',
              variants: [
                { key: 'A', description: locale === 'ar' ? 'فائدة' : 'Benefit-led' },
                { key: 'B', description: locale === 'ar' ? 'منتج' : 'Product-led' },
              ],
              primary_metric: 'CTR',
              duration_days: 14,
            },
          ],
        }
      : null,
  };
}
