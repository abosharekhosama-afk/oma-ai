import { describe, expect, it } from 'vitest';
import {
  allocateBudget,
  organicPlanInputSchema,
  organicPlanIssues,
  paidPlanInputSchema,
  paidPlanIssues,
} from './tracks-v2';
import { aiEstimateResearchAdapter, manualResearchAdapter } from './research-port';

const pillar = (key: string, share?: number) => ({
  key,
  name_en: `Pillar ${key}`,
  name_ar: `ركيزة ${key}`,
  share_target_pct: share,
});

describe('organic plan schema + invariants', () => {
  it('applies defaults and accepts a valid plan', () => {
    const plan = organicPlanInputSchema.parse({
      pillars: [pillar('education', 60), pillar('product', 40)],
      seo_keywords: [
        { keyword: 'عناية بالبشرة', intent: 'INFORMATIONAL', pillar_key: 'education' },
      ],
      content_gaps: [{ kind: 'MISSING_TOPIC', topic: 'Routine guides', pillar_key: 'education' }],
    });
    expect(plan.seo_keywords[0]).toMatchObject({ locale: 'ar', priority: 3, source: 'MANUAL' });
    expect(plan.pillars[0]!.info_class).toBe('USER_AUTHORED');
    expect(organicPlanIssues(plan)).toEqual([]);
  });

  it('rejects unknown fields (strict) and bad slugs', () => {
    expect(
      organicPlanInputSchema.safeParse({ pillars: [{ ...pillar('A b'), x: 1 }] }).success,
    ).toBe(false);
  });

  it('flags duplicate keys, share > 100, unknown pillar refs and unlabelled metrics', () => {
    const plan = organicPlanInputSchema.parse({
      pillars: [pillar('a', 70), pillar('a', 40)],
      seo_keywords: [
        { keyword: 'Shoes', intent: 'COMMERCIAL', pillar_key: 'missing', monthly_volume: 900 },
        { keyword: 'shoes', intent: 'COMMERCIAL' },
      ],
      content_gaps: [{ kind: 'THIN_CONTENT', topic: 't', pillar_key: 'nope' }],
    });
    const codes = organicPlanIssues(plan).map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'DUPLICATE_PILLAR_KEY',
        'PILLAR_SHARE_OVER_100',
        'UNKNOWN_PILLAR',
        'METRIC_SOURCE_REQUIRED',
        'DUPLICATE_KEYWORD',
      ]),
    );
  });
});

describe('paid plan schema + invariants', () => {
  const base = {
    allocations: [
      { platform: 'INSTAGRAM', objective: 'AWARENESS', share_pct: 60 },
      { platform: 'TIKTOK', objective: 'TRAFFIC', share_pct: 40 },
    ],
    audiences: [
      { key: 'gulf-women', name: 'Gulf women 25-40', targeting: { age_min: 25, age_max: 40 } },
    ],
    experiments: [
      {
        name: 'Hook test',
        hypothesis: 'UGC hook beats studio hook',
        variable: 'CREATIVE',
        audience_key: 'gulf-women',
        variants: [
          { key: 'A', description: 'UGC' },
          { key: 'B', description: 'Studio' },
        ],
        primary_metric: 'CTR',
      },
    ],
  };

  it('accepts a balanced plan', () => {
    const plan = paidPlanInputSchema.parse(base);
    expect(plan.experiments[0]!.status).toBe('PLANNED');
    expect(paidPlanIssues(plan)).toEqual([]);
  });

  it('requires allocations to sum to 100 and experiments to have two variants', () => {
    const plan = paidPlanInputSchema.parse({
      ...base,
      allocations: [{ platform: 'META', objective: 'SALES', share_pct: 90 }],
    });
    expect(paidPlanIssues(plan).map((i) => i.code)).toContain('ALLOCATION_NOT_100');
    expect(
      paidPlanInputSchema.safeParse({
        experiments: [{ ...base.experiments[0], variants: [{ key: 'A', description: 'x' }] }],
      }).success,
    ).toBe(false);
  });

  it('flags age range, duplicate variants and unknown audiences', () => {
    const plan = paidPlanInputSchema.parse({
      allocations: [],
      audiences: [{ key: 'x', name: 'X', targeting: { age_min: 50, age_max: 20 } }],
      experiments: [
        {
          ...base.experiments[0],
          audience_key: 'ghost',
          variants: [
            { key: 'A', description: '1' },
            { key: 'A', description: '2' },
          ],
        },
      ],
    });
    expect(paidPlanIssues(plan).map((i) => i.code)).toEqual(
      expect.arrayContaining(['AGE_RANGE_INVALID', 'DUPLICATE_VARIANT', 'UNKNOWN_AUDIENCE']),
    );
  });
});

describe('allocateBudget', () => {
  it('splits by largest remainder and keeps the total', () => {
    const parts = allocateBudget(1000, [33, 33, 34]);
    expect(parts).toEqual([330, 330, 340]);
    const odd = allocateBudget(100, [33, 33, 34]);
    expect(odd.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });
  it('returns zeros for empty or invalid budgets', () => {
    expect(allocateBudget(0, [50, 50])).toEqual([0, 0]);
  });
});

describe('research port adapters', () => {
  it('manual never invents metrics', async () => {
    const [row] = await manualResearchAdapter.keywordMetrics({
      keywords: [{ keyword: 'k', locale: 'ar' }],
    });
    expect(row).toMatchObject({ monthly_volume: null, difficulty: null, source: 'MANUAL' });
    expect(manualResearchAdapter.measured).toBe(false);
  });
  it('ai estimate is always labelled AI_ESTIMATE and clamped', async () => {
    const port = aiEstimateResearchAdapter(async (req) =>
      req.keywords.map((k) => ({
        ...k,
        monthly_volume: -5,
        difficulty: 140,
        intent: 'COMMERCIAL',
      })),
    );
    const [row] = await port.keywordMetrics({ keywords: [{ keyword: 'k', locale: 'en' }] });
    expect(row).toMatchObject({ monthly_volume: 0, difficulty: 100, source: 'AI_ESTIMATE' });
  });
});
