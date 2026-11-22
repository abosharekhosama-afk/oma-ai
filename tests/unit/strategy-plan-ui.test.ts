import { describe, expect, it } from 'vitest';
import en from '../../packages/i18n/messages/en.json';
import ar from '../../packages/i18n/messages/ar.json';
import {
  allocationTotal,
  organicPlanWarnings,
  paidPayload,
  paidPlanWarnings,
  planSourceLabelKey,
  slugifyKey,
} from '../../apps/web/src/lib/strategy-plan-api';
import {
  BRIEF_ACTION_PATH,
  briefActionButtons,
  newDeliverable,
} from '../../apps/web/src/lib/brief-api';
import {
  brandNavSection,
  buildBrandStrategySubnav,
} from '../../apps/web/src/lib/brand-workspace-nav';

const messages = { en: en as Record<string, string>, ar: ar as Record<string, string> };

describe('strategy plan UI helpers', () => {
  it('never labels estimates as measured', () => {
    expect(planSourceLabelKey('AI_ESTIMATE')).toBe('strategy.plan.source.aiEstimate');
    expect(planSourceLabelKey(undefined)).toBe('strategy.plan.source.manual');
    for (const source of [
      'MANUAL',
      'AI_ESTIMATE',
      'DETERMINISTIC',
      'BRAND_PROFILE',
      'EXTERNAL',
      'FIXTURE',
    ] as const) {
      const key = planSourceLabelKey(source);
      expect(messages.en[key]).toBeTruthy();
      expect(messages.ar[key]).toBeTruthy();
    }
  });

  it('mirrors server invariants before save', () => {
    const paid = {
      allocations: [{ platform: 'META', objective: 'SALES', share_pct: 60, amount: '600.00' }],
      audiences: [],
      experiments: [
        {
          name: 'x',
          hypothesis: 'y',
          variable: 'COPY',
          variants: [{ key: 'A', description: 'a' }],
          primary_metric: 'CTR',
        },
      ],
    };
    expect(allocationTotal(paid.allocations)).toBe(60);
    expect(paidPlanWarnings(paid)).toEqual([
      'strategy.plan.warn.allocationTotal',
      'strategy.plan.warn.variants',
    ]);
    expect(paidPayload(paid).allocations[0]).not.toHaveProperty('amount');
    expect(
      organicPlanWarnings({
        pillars: [
          { key: 'a', name_en: 'A', name_ar: 'أ', share_target_pct: 70 },
          { key: 'a', name_en: 'B', name_ar: 'ب', share_target_pct: 40 },
        ],
        seo_keywords: [],
        content_gaps: [],
      }),
    ).toEqual(['strategy.plan.warn.pillarShare', 'strategy.plan.warn.duplicateKey']);
  });

  it('slugifies keys and falls back for Arabic-only names', () => {
    expect(slugifyKey('Product & Services', 'p')).toBe('product-services');
    expect(slugifyKey('التثقيف', 'pillar-1')).toBe('pillar-1');
  });
});

describe('brief UI helpers', () => {
  it('orders lifecycle buttons and maps routes', () => {
    expect(briefActionButtons(['edit', 'submit', 'cancel'])).toEqual(['submit', 'cancel']);
    expect(briefActionButtons(['approve', 'request_changes', 'cancel'])).toEqual([
      'approve',
      'request_changes',
      'cancel',
    ]);
    expect(BRIEF_ACTION_PATH.request_changes).toBe('request-changes');
    expect(newDeliverable(0).key).toBe('deliverable-1');
  });

  it('has EN and AR copy for every status, action and decision', () => {
    const keys = [
      ...['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'CONVERTED', 'CANCELLED'].map(
        (s) => `briefs.status.${s}`,
      ),
      ...Object.keys(BRIEF_ACTION_PATH).flatMap((a) => [
        `briefs.action.${a}`,
        `briefs.action.done.${a}`,
      ]),
      ...['SUBMIT', 'APPROVE', 'REQUEST_CHANGES', 'REVISE', 'CONVERT', 'CANCEL'].map(
        (d) => `briefs.decision.${d}`,
      ),
    ];
    for (const key of keys) {
      expect(messages.en[key], key).toBeTruthy();
      expect(messages.ar[key], key).toBeTruthy();
    }
  });

  it('places briefs in the strategy section of the brand nav', () => {
    expect(brandNavSection('/app/brands/b1/briefs/x', 'b1')).toBe('strategy');
    const links = buildBrandStrategySubnav('b1', (k) => k).map((l) => l.id);
    expect(links).toEqual(['intelligence-hub', 'profiles', 'strategies', 'briefs']);
  });
});
