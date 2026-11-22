import { describe, expect, it } from 'vitest';
import { insightReviewProgress } from '../../apps/web/src/lib/brand-intelligence';
import { aiProviderName, errorCodeLabel } from '../../apps/web/src/lib/brand-format';
import {
  buildBrandEvidenceSubnav,
  buildBrandStrategySubnav,
  withJourneyState,
} from '../../apps/web/src/lib/brand-workspace-nav';

const t = (k: string) => k;

describe('insightReviewProgress', () => {
  it('counts reviewed vs pending insights', () => {
    expect(
      insightReviewProgress([
        { review_status: 'PENDING' },
        { review_status: 'ACCEPTED' },
        { review_status: 'EDITED' },
        { review_status: 'REJECTED' },
      ]),
    ).toEqual({ total: 4, pending: 1, reviewed: 3, percent: 75 });
    expect(insightReviewProgress([])).toEqual({ total: 0, pending: 0, reviewed: 0, percent: 0 });
  });
});

describe('brand format helpers', () => {
  it('names AI providers and returns null for unknown ones', () => {
    expect(aiProviderName('gemini')).toBe('Google Gemini');
    expect(aiProviderName('OPENAI')).toBe('OpenAI');
    expect(aiProviderName('test-adapter')).toBeNull();
  });

  it('only returns friendly copy for known error codes', () => {
    const lookup = (k: string) => (k === 'errors.website_unreachable' ? 'Unreachable' : k);
    expect(errorCodeLabel(lookup, 'WEBSITE_UNREACHABLE')).toBe('Unreachable');
    expect(errorCodeLabel(lookup, 'SOMETHING_ELSE')).toBeNull();
    expect(errorCodeLabel(lookup, null)).toBeNull();
  });
});

describe('withJourneyState', () => {
  const journey = [
    { id: 'connect', state: 'done' as const },
    { id: 'scan', state: 'done' as const },
    { id: 'discover', state: 'current' as const },
    { id: 'intel', state: 'todo' as const },
    { id: 'strategy', state: 'todo' as const },
  ];

  it('folds journey progress into the evidence sub-nav', () => {
    const links = withJourneyState(buildBrandEvidenceSubnav('b1', 's1', t), journey);
    expect(Object.fromEntries(links.map((l) => [l.id, l.state ?? null]))).toEqual({
      website: 'done',
      scan: 'done',
      discovery: 'current',
      // SEO tab (74e13941) has no journey step, so it carries no state.
      seo: null,
      'evidence-hub': null,
    });
  });

  it('folds journey progress into the strategy sub-nav and is a no-op without a journey', () => {
    const links = withJourneyState(buildBrandStrategySubnav('b1', t), journey);
    expect(links.find((l) => l.id === 'profiles')?.state).toBe('todo');
    expect(links.find((l) => l.id === 'intelligence-hub')?.state).toBeUndefined();
    const plain = buildBrandStrategySubnav('b1', t);
    expect(withJourneyState(plain, undefined)).toBe(plain);
  });
});
