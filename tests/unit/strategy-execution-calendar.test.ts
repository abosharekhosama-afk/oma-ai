import { describe, expect, it } from 'vitest';
import {
  buildCalendarSlots,
  buildPlanWorkRequestDrafts,
  findSlotCollisions,
  isSeoFixtureSource,
  localizeSeoGapTopic,
  planDraftBriefTitle,
  seoFixturesAllowed,
  spreadPlannedDates,
  visibleSeoRows,
} from '@oma/domain';
import {
  displayContentLabels,
  isInternalContentLabel,
  pillarChipText,
} from '../../apps/web/src/lib/content-display-text';
import { reviewMonthOptions } from '../../apps/web/src/lib/strategy-month';
import {
  planGroupOf,
  planSummary,
} from '../../apps/web/src/components/strategy/strategy-plan-requests-panel';

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;

describe('calendar slots never collide', () => {
  const cadence = ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'Blog'].map((channel) => ({
    channel,
    posts_per_week: 4,
    formats: ['Post'],
  }));
  const pillars = [
    { key: 'a', share_target_pct: 60 },
    { key: 'b', share_target_pct: 40 },
  ];

  it('gives every channel on the same day its own time', () => {
    const plan = buildCalendarSlots({
      cadence,
      pillars,
      startDate: '2026-11-23',
      weeks: 4,
      timezone: 'Asia/Jerusalem',
    });
    expect(plan.slots).toHaveLength(5 * 4 * 4);
    expect(findSlotCollisions(plan.slots.map((s) => s.planned_at))).toEqual([]);
  });

  it('keeps dense days unique (28 posts/week on several channels)', () => {
    const plan = buildCalendarSlots({
      cadence: cadence.map((c) => ({ ...c, posts_per_week: 28 })),
      pillars,
      startDate: '2026-11-23',
      weeks: 1,
      timezone: 'UTC',
    });
    expect(findSlotCollisions(plan.slots.map((s) => s.planned_at))).toEqual([]);
  });

  it('one-off items avoid cadence slots and each other', () => {
    const plan = buildCalendarSlots({
      cadence,
      pillars,
      startDate: '2026-11-23',
      weeks: 1,
      timezone: 'Asia/Jerusalem',
    });
    const oneOff = spreadPlannedDates({
      count: 40,
      startDate: '2026-11-23',
      weeks: 1,
      timezone: 'Asia/Jerusalem',
      taken: plan.slots.map((s) => s.planned_at),
    });
    expect(findSlotCollisions([...plan.slots.map((s) => s.planned_at), ...oneOff])).toEqual([]);
  });
});

describe('internal plan tags are hidden on the calendar', () => {
  it('drops bookkeeping labels and keeps user labels', () => {
    const labels = [
      'strategy-plan',
      'organic:catalog:product:52',
      'organic:pillar:product-highlights',
      'paid:allocation:0:meta:sales',
      'strategy-version:01M81R0W7W8Y35HYXJ0SSE9Y5Q',
      'plan-slot:0:instagram:3',
      'pillar:product-highlights',
      'حملة الشتاء',
      'launch',
    ];
    expect(displayContentLabels(labels)).toEqual(['حملة الشتاء', 'launch']);
    expect(isInternalContentLabel('organic')).toBe(false);
  });

  it('shows the pillar name in the reader language', () => {
    const name = { en: 'Product Highlights', ar: 'استكشاف منتجات فيلفت' };
    expect(pillarChipText(name, 'ar')).toBe('استكشاف منتجات فيلفت');
    expect(pillarChipText(name, 'en')).toBe('Product Highlights');
    expect(pillarChipText({ en: 'Only EN', ar: '' }, 'ar')).toBe('Only EN');
    expect(pillarChipText(null, 'ar')).toBeNull();
  });
});

describe('sample SEO data stays out of real environments', () => {
  it('turns fixtures off on hosted deploys unless explicitly allowed', () => {
    expect(seoFixturesAllowed(env({ NODE_ENV: 'test' }))).toBe(true);
    expect(seoFixturesAllowed(env({ RENDER: 'true' }))).toBe(false);
    expect(seoFixturesAllowed(env({ NODE_ENV: 'development', VERCEL: '1' }))).toBe(false);
    expect(seoFixturesAllowed(env({ RENDER: 'true', SEO_FIXTURES_ALLOWED: 'true' }))).toBe(true);
    expect(seoFixturesAllowed(env({ NODE_ENV: 'production' }))).toBe(false);
  });

  it('hides persisted fixture rows on read', () => {
    const rows = [
      { keyword: 'ألعاب تعليمية', source: 'AI_ESTIMATE' },
      { keyword: 'organic skincare', source: 'FIXTURE' },
      { keyword: 'brand name', source: 'GSC_FIXTURE' },
      { keyword: 'manual', source: 'MANUAL' },
    ];
    expect(visibleSeoRows(rows, env({ RENDER: 'true' })).map((r) => r.keyword)).toEqual([
      'ألعاب تعليمية',
      'manual',
    ]);
    expect(visibleSeoRows(rows, env({ NODE_ENV: 'test' }))).toHaveLength(4);
    expect(isSeoFixtureSource('gsc_fixture')).toBe(true);
    expect(isSeoFixtureSource('GSC_LIVE')).toBe(false);
  });
});

describe('content gap topics in the brand language', () => {
  it('localizes audit-generated topics', () => {
    expect(localizeSeoGapTopic('Thin body copy · velvetgro.com', 'ar')).toBe(
      'محتوى نصي قليل · velvetgro.com',
    );
    expect(localizeSeoGapTopic('CANONICAL MISSING · velvetgro.com', 'ar')).toBe(
      'رابط Canonical مفقود · velvetgro.com',
    );
    expect(localizeSeoGapTopic('H1 heading · /products', 'ar')).toBe(
      'العنوان الرئيسي (H1) · /products',
    );
    expect(localizeSeoGapTopic('دليل استخدام لعبة', 'ar')).toBe('دليل استخدام لعبة');
    expect(localizeSeoGapTopic('Thin body copy · velvetgro.com', 'en')).toBe(
      'Thin body copy · velvetgro.com',
    );
  });
});

describe('plan drafts are written in the brand language', () => {
  const drafts = buildPlanWorkRequestDrafts({
    strategyName: 'ترويج جديد',
    foundation: {},
    organicEnabled: true,
    paidEnabled: false,
    organic: { channels: ['Instagram'], formats: ['Post'] },
    paid: null,
    audiences: [],
    catalogOfferings: [
      {
        kind: 'product',
        slug: 'lego-52',
        name: 'ليجو بناء خشبي 52 قطعة',
        category: null,
        description: null,
        primary_media_view_url: null,
      } as never,
      {
        kind: 'service',
        slug: 'workshop',
        name: 'ورشة اللعب',
        category: null,
        description: null,
        primary_media_view_url: null,
      } as never,
    ],
  });

  it('has no English template text in the Arabic fields', () => {
    const englishTemplate =
      /Product:|Service:|Spotlight|Organic content|feature .* with evidence|Explain service|Primary audience|Deliver the approved/;
    for (const d of drafts) {
      for (const text of [
        d.title.ar,
        d.description.ar,
        d.brief.objective.ar,
        d.brief.audience.ar,
        d.brief.keyMessage.ar,
      ]) {
        expect(text).not.toMatch(englishTemplate);
      }
    }
    const product = drafts.find((d) => d.plan_source_key.includes(':product:'))!;
    expect(product.title.ar).toBe('ترويج جديد — منتج: ليجو بناء خشبي 52 قطعة');
    expect(product.title.en).toContain('Product:');
  });

  it('names briefs in the strategy language', () => {
    const product = drafts.find((d) => d.plan_source_key.includes(':product:'))!;
    expect(planDraftBriefTitle(product, 'ترويج جديد')).toBe(product.title.ar);
    expect(planDraftBriefTitle(product, 'Winter launch')).toBe(product.title.en);
  });
});

describe('execution summary + month picker', () => {
  it('groups plan items by type, channel and status', () => {
    const items = [
      {
        plan_source_key: 'organic:pillar:a',
        track: 'organic',
        channels: ['Instagram'],
        already_created: true,
      },
      {
        plan_source_key: 'organic:catalog:product:x',
        track: 'organic',
        channels: ['Instagram', 'TikTok'],
        already_created: false,
      },
      {
        plan_source_key: 'organic:catalog:product:y',
        track: 'organic',
        channels: [],
        already_created: false,
        default_selected: false,
      },
      {
        plan_source_key: 'organic:catalog:service:z',
        track: 'organic',
        channels: [],
        already_created: false,
      },
      {
        plan_source_key: 'paid:allocation:0:meta:sales',
        track: 'paid',
        channels: ['Meta'],
        already_created: false,
      },
    ];
    const s = planSummary(items);
    expect(s.total).toBe(5);
    expect(s.created).toBe(1);
    expect(s.pendingDefault).toBe(3);
    expect(s.groups).toEqual([
      { group: 'pillar', count: 1 },
      { group: 'product', count: 2 },
      { group: 'service', count: 1 },
      { group: 'paid', count: 1 },
    ]);
    expect(s.channels[0]).toEqual({ channel: 'Instagram', count: 2 });
    expect(planGroupOf(items[3]!)).toBe('service');
  });

  it('lists months from the strategy start to now, newest first, localized', () => {
    const now = new Date('2026-11-22T10:00:00Z');
    const opts = reviewMonthOptions('2026-09-15T00:00:00Z', now, 'ar');
    expect(opts.map((o) => o.value)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(opts[0]!.label).toMatch(/نوفمبر/);
    expect(opts[0]!.label).not.toMatch(/November/);
    expect(reviewMonthOptions(null, now, 'en').map((o) => o.value)).toEqual(['2026-11']);
    expect(reviewMonthOptions('2027-01-01T00:00:00Z', now, 'en').map((o) => o.value)).toEqual([
      '2026-11',
    ]);
  });
});
