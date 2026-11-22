import { describe, expect, it } from 'vitest';
import { buildPlanWorkRequestDrafts, pillarSourceKey } from './plan-work-requests';
import {
  organicPlanInputSchema,
  organicPlanIssues,
  pillarKeyFromLabel,
  postsPerWeekFromText,
} from './tracks-v2';
import { deterministicStrategyPlanProposal, validateStrategyPlanProposal } from './plan-proposal';

describe('DEC-029 4.1 single organic plan model', () => {
  it('parses posts per week from legacy frequency text', () => {
    expect(postsPerWeekFromText('3 posts per week')).toBe(3);
    expect(postsPerWeekFromText('2 daily')).toBe(14);
    expect(postsPerWeekFromText('يوميا')).toBe(7);
    expect(postsPerWeekFromText('8 per month')).toBe(2);
    expect(postsPerWeekFromText('')).toBeNull();
    expect(postsPerWeekFromText('when possible')).toBeNull();
  });

  it('builds unique slug pillar keys, falling back for non-latin labels', () => {
    const taken = new Set<string>();
    expect(pillarKeyFromLabel('Product Education', 0, taken)).toBe('product-education');
    expect(pillarKeyFromLabel('Product education!', 1, taken)).toBe('product-education-2');
    expect(pillarKeyFromLabel('التعريف بالمنتج', 2, taken)).toBe('pillar-3');
  });

  it('keeps legacy source keys for backfilled pillars', () => {
    expect(pillarSourceKey('legacy-1')).toBe('organic:pillar:0');
    expect(pillarSourceKey('education')).toBe('organic:pillar:education');
  });

  it('flags duplicate cadence channels', () => {
    const plan = organicPlanInputSchema.parse({
      cadence: [
        { channel: 'Instagram', posts_per_week: 3 },
        { channel: 'instagram ', posts_per_week: 1 },
      ],
    });
    expect(organicPlanIssues(plan).map((i) => i.code)).toContain('DUPLICATE_CHANNEL');
  });

  it('prefers v2 pillars and active cadence over legacy lists', () => {
    const drafts = buildPlanWorkRequestDrafts({
      strategyName: 'Q1',
      foundation: { goals: ['Grow'] },
      organicEnabled: true,
      paidEnabled: false,
      organic: { pillars: ['Old pillar'], channels: ['Facebook'], formats: ['Post'] },
      paid: null,
      audiences: [],
      organicPlan: organicPlanInputSchema.parse({
        cadence: [
          { channel: 'Instagram', posts_per_week: 4, formats: ['Reel'] },
          { channel: 'Blog', posts_per_week: 0, formats: ['Article'] },
        ],
        pillars: [{ key: 'tips', name_en: 'Tips', name_ar: 'نصائح' }],
      }),
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      plan_source_key: 'organic:pillar:tips',
      channels: ['Instagram'],
      formats: ['Reel'],
      title: { en: 'Q1 — Tips', ar: 'Q1 — نصائح' },
    });
  });

  it('falls back to legacy lists when v2 is empty', () => {
    const drafts = buildPlanWorkRequestDrafts({
      strategyName: 'Q1',
      foundation: {},
      organicEnabled: true,
      paidEnabled: false,
      organic: { pillars: ['Old pillar'], channels: ['Facebook'], formats: ['Post'] },
      paid: null,
      audiences: [],
      organicPlan: organicPlanInputSchema.parse({}),
    });
    expect(drafts[0]).toMatchObject({
      plan_source_key: 'organic:pillar:0',
      channels: ['Facebook'],
      formats: ['Post'],
    });
  });

  it('accepts stored proposals without cadence and maps AI cadence when present', () => {
    const proposal = deterministicStrategyPlanProposal({
      brandName: 'Acme',
      language: 'en',
      products: 'Soap',
      services: '',
      audiences: '',
      tracks: { organic: true, paid: false },
    });
    const { cadence: _omit, ...legacyOrganic } = proposal.organic!;
    const legacy = validateStrategyPlanProposal(
      { ...proposal, organic: legacyOrganic },
      { organic: true, paid: false },
      { source: 'DETERMINISTIC' },
    );
    expect(legacy.ok).toBe(true);
    if (legacy.ok) expect(legacy.inputs.organic?.cadence).toBeUndefined();

    const withCadence = validateStrategyPlanProposal(
      {
        ...proposal,
        organic: {
          ...proposal.organic!,
          cadence: [{ channel: 'TikTok', posts_per_week: 2, formats: [] }],
        },
      },
      { organic: true, paid: false },
      { source: 'AI_ESTIMATE' },
    );
    expect(withCadence.ok).toBe(true);
    if (withCadence.ok) {
      expect(withCadence.inputs.organic?.cadence?.[0]).toMatchObject({
        channel: 'TikTok',
        info_class: 'AI_PROPOSAL',
        source: 'AI_ESTIMATE',
      });
    }
  });
});

describe('DEC-029 4.2 product picker defaults', () => {
  it('pre-selects 10 products, approved-media first, and lists the rest unselected', () => {
    const catalog = Array.from({ length: 14 }, (_, i) => ({
      kind: 'product' as const,
      name: `P${i}`,
      slug: `p${i}`,
      ...(i === 12 ? { primary_media_view_url: '/m/12' } : {}),
    }));
    const drafts = buildPlanWorkRequestDrafts({
      strategyName: 'Q1',
      foundation: {},
      organicEnabled: true,
      paidEnabled: false,
      organic: null,
      paid: null,
      audiences: [],
      catalogOfferings: catalog,
    });
    const products = drafts.filter((d) => d.plan_source_key.startsWith('organic:catalog:product:'));
    expect(products).toHaveLength(14);
    expect(products[0]!.plan_source_key).toBe('organic:catalog:product:p12');
    expect(products.filter((d) => d.default_selected)).toHaveLength(10);
    expect(products.at(-1)!.default_selected).toBe(false);
  });
});
