import { describe, expect, it } from 'vitest';
import { isMeaningfulPositioning } from '@oma/domain';
import { fallbackStrategyJourney } from '../../apps/web/src/lib/strategy-readiness';
import {
  strategyRouteParts,
  strategySectionLabel,
} from '../../apps/web/src/lib/brand-workspace-nav';
import { brandPrimaryNextStep } from '../../apps/web/src/lib/brand-journey';
import { buildBrandPipelineStages } from '../../apps/web/src/lib/brand-pipeline-outcome';
import type { BrandDetail } from '../../apps/web/src/lib/brand-types';
import en from '../../packages/i18n/messages/en.json';
import ar from '../../packages/i18n/messages/ar.json';

const t = (key: string) => key;
const SID = '01M81R0W7W0H4TTKD8Y2DNSBXG';

function brand(overrides: Partial<BrandDetail> = {}): BrandDetail {
  return {
    id: 'b1',
    name: 'Velvet',
    status: 'ACTIVE',
    version: 1,
    current_approved_profile_version_id: 'p1',
    current_approved_strategy_id: null,
    website: {
      website_source_id: 'w',
      normalized_url: 'https://ex.test',
      validation_status: 'VALID',
      source_revision: 1,
    },
    latest_scan: { id: 's1', status: 'SUCCEEDED', job_run_id: 'j', connector_mode: 'LIVE' },
    next_scan_connector_mode: 'LIVE',
    archived_at: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  } as BrandDetail;
}

describe('guided strip fallback journey (#2)', () => {
  it('draft with empty foundation starts at foundation', () => {
    const j = fallbackStrategyJourney({ status: 'DRAFT', foundation: {} });
    expect(j.current).toBe('foundation');
  });

  it('draft with foundation and a plan moves to submit', () => {
    const j = fallbackStrategyJourney({
      status: 'DRAFT',
      foundation: { goals: ['Grow'], positioning: { value: 'Safe creative toys for kids' } },
      organic_enabled: true,
      organic: { pillars: ['Play'] },
    });
    expect(j.current).toBe('submit');
  });

  it('approved strategy points at execution (ابدأ التنفيذ)', () => {
    const j = fallbackStrategyJourney({ status: 'APPROVED', foundation: {} });
    expect(j.current).toBe('execute');
    expect(j.steps.find((s) => s.id === 'approve')?.state).toBe('done');
  });
});

describe('strategy breadcrumb parts (#3)', () => {
  it('parses strategy id and section', () => {
    expect(strategyRouteParts(`/app/brands/b1/strategies/${SID}`, 'b1')).toEqual({
      strategyId: SID,
      section: null,
    });
    expect(strategyRouteParts(`/app/brands/b1/strategies/${SID}/execution`, 'b1')).toEqual({
      strategyId: SID,
      section: 'execution',
    });
    expect(strategyRouteParts('/app/brands/b1/strategies/new', 'b1')).toBeNull();
    expect(strategyRouteParts('/app/brands/b1/strategies', 'b1')).toBeNull();
  });

  it('labels sections with real keys (never raw "execution")', () => {
    expect(strategySectionLabel('execution', t)).toBe('strategy.tab.execution');
    expect(strategySectionLabel('evidence', t)).toBe('strategy.nav.evidence');
    expect(strategySectionLabel(null, t)).toBeNull();
  });
});

describe('brand journey with existing strategies (#1)', () => {
  it('offers "continue" instead of a second "create" when a draft exists', () => {
    const next = brandPrimaryNextStep('b1', brand({ active_strategy_count: 2 }), t);
    expect(next.href).toBe('/app/brands/b1/strategies');
    expect(next.label).toBe('brand.detail.continueStrategyCta');
  });

  it('still offers create when there is no strategy at all', () => {
    const next = brandPrimaryNextStep('b1', brand({ active_strategy_count: 0 }), t);
    expect(next.href).toBe('/app/brands/b1/strategies/new');
  });

  it('an inferred current strategy unblocks plan → requests and calendar', () => {
    const stages = buildBrandPipelineStages(
      'b1',
      brand({ current_approved_strategy_id: SID, current_strategy_inferred: true }),
      null,
      t,
      { work_request_count: 0, content_count: 0 },
    );
    const plan = stages.find((s) => s.id === 'plan_requests')!;
    expect(plan.state).toBe('current');
    expect(plan.href).toBe(`/app/brands/b1/strategies/${SID}/execution`);
  });
});

describe('positioning validation (#7)', () => {
  it('rejects a single placeholder word', () => {
    expect(isMeaningfulPositioning('الموضوع')).toBe(false);
    expect(isMeaningfulPositioning('topic')).toBe(false);
    expect(isMeaningfulPositioning('')).toBe(false);
  });
  it('accepts a real sentence', () => {
    expect(isMeaningfulPositioning('ألعاب إبداعية وآمنة تساعد الأطفال على التعلم')).toBe(true);
  });
});

describe('DEC-030 i18n keys', () => {
  const keys = [
    'strategy.status.CURRENT',
    'strategy.status.APPROVED',
    'strategy.status.IN_REVIEW',
    'strategy.status.CHANGES_REQUESTED',
    'strategy.status.DRAFT',
    'strategy.status.ARCHIVED',
    'strategy.current.set',
    'strategy.current.pin',
    'strategy.executionTab.start',
    'strategy.track.paused',
    'brand.detail.continueStrategyCta',
    'strategy.foundation.goalsHint',
    'strategy.foundation.positioningPlaceholder',
    'strategy.foundation.positioningTooShort',
    'strategy.evidence.profileTitle',
    'strategy.review.commentsTitle',
  ];
  it.each(keys)('%s exists in EN and AR, and AR is Arabic', (key) => {
    const e = (en as Record<string, string>)[key];
    const a = (ar as Record<string, string>)[key];
    expect(e).toBeTruthy();
    expect(a).toBeTruthy();
    expect(/[\u0600-\u06FF]/.test(a!)).toBe(true);
  });
  it('the next-step execute action reads "ابدأ التنفيذ"', () => {
    expect((ar as Record<string, string>)['strategy.next.action.execute']).toBe('ابدأ التنفيذ');
  });
});
