import { describe, expect, it } from 'vitest';
import {
  STRATEGY_BLOCKING_CODES,
  checkFoundation,
  expandFoundationReasons,
  strategyBlockingItem,
  strategyJourney,
} from './strategy-readiness';

const full = { hasGoals: true, hasPositioning: true };

describe('checkFoundation', () => {
  it('needs non-empty goals and positioning', () => {
    expect(checkFoundation({})).toEqual({ hasGoals: false, hasPositioning: false });
    expect(
      checkFoundation({
        goals: [{ value: '  ' }],
        positioning: { value: '' },
      }),
    ).toEqual({ hasGoals: false, hasPositioning: false });
    expect(
      checkFoundation({ goals: ['Grow'], positioning: { value: 'Trusted', infoClass: 'AI' } }),
    ).toEqual(full);
    expect(checkFoundation({ goals: 'Grow', positioning: 'Trusted' })).toEqual(full);
  });
});

describe('expandFoundationReasons', () => {
  it('replaces the coarse code with the exact missing field', () => {
    expect(
      expandFoundationReasons(['REQUIRED_FOUNDATION_FIELDS', 'UNKNOWNS_ACK_REQUIRED'], {
        hasGoals: true,
        hasPositioning: false,
      }),
    ).toEqual(['FOUNDATION_POSITIONING_REQUIRED', 'UNKNOWNS_ACK_REQUIRED']);
    expect(
      expandFoundationReasons(['REQUIRED_FOUNDATION_FIELDS'], {
        hasGoals: false,
        hasPositioning: false,
      }),
    ).toEqual(['FOUNDATION_GOALS_REQUIRED', 'FOUNDATION_POSITIONING_REQUIRED']);
  });
});

describe('strategyBlockingItem', () => {
  it('maps every known code to a fix path', () => {
    for (const code of STRATEGY_BLOCKING_CODES) {
      const item = strategyBlockingItem(code);
      expect(item.fix_path.startsWith('/'), code).toBe(true);
    }
    expect(strategyBlockingItem('PAID_BUDGET_REQUIRED')).toEqual({
      code: 'PAID_BUDGET_REQUIRED',
      section: 'paid',
      fix_path: '/paid',
    });
  });
  it('falls back to the review page for unknown codes', () => {
    expect(strategyBlockingItem('SOMETHING_NEW').fix_path).toBe('/review');
  });
});

describe('strategyJourney', () => {
  const ids = (j: ReturnType<typeof strategyJourney>) => j.steps.map((s) => `${s.id}:${s.state}`);

  it('starts at foundation for an empty draft', () => {
    const j = strategyJourney({
      versionStatus: 'DRAFT',
      foundation: { hasGoals: false, hasPositioning: false },
      planHasContent: false,
    });
    expect(j.current).toBe('foundation');
    expect(ids(j)).toEqual([
      'foundation:current',
      'plan:todo',
      'submit:todo',
      'approve:todo',
      'execute:todo',
    ]);
  });

  it('moves to plan, then submit', () => {
    expect(
      strategyJourney({ versionStatus: 'DRAFT', foundation: full, planHasContent: false }).current,
    ).toBe('plan');
    expect(
      strategyJourney({ versionStatus: 'DRAFT', foundation: full, planHasContent: true }).current,
    ).toBe('submit');
  });

  it('waits on approval while in review, then points to execution', () => {
    const review = strategyJourney({
      versionStatus: 'IN_REVIEW',
      foundation: full,
      planHasContent: true,
    });
    expect(review.current).toBe('approve');
    expect(review.steps.find((s) => s.id === 'submit')?.state).toBe('done');
    expect(
      strategyJourney({ versionStatus: 'APPROVED', foundation: full, planHasContent: true })
        .current,
    ).toBe('execute');
    const finished = strategyJourney({
      versionStatus: 'APPROVED',
      foundation: full,
      planHasContent: true,
      executionStarted: true,
    });
    expect(finished.current).toBeNull();
    expect(finished.steps.every((s) => s.state === 'done')).toBe(true);
  });

  it('asks for a revise after changes are requested', () => {
    expect(
      strategyJourney({
        versionStatus: 'CHANGES_REQUESTED',
        foundation: full,
        planHasContent: true,
      }).current,
    ).toBe('submit');
  });
});
