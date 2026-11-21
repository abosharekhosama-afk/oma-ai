import { describe, expect, it } from 'vitest';
import { evaluatePaidPlanForSubmit } from './paid-plan-submit';
import type { PaidPlanInput } from './tracks-v2';

const emptyPaid = (): PaidPlanInput => ({
  allocations: [],
  audiences: [],
  experiments: [],
});

describe('evaluatePaidPlanForSubmit', () => {
  it('passes when paid track is disabled', () => {
    expect(
      evaluatePaidPlanForSubmit({
        paidEnabled: false,
        budgetAmount: null,
        plan: emptyPaid(),
      }).ok,
    ).toBe(true);
  });

  it('blocks when budget missing', () => {
    const result = evaluatePaidPlanForSubmit({
      paidEnabled: true,
      budgetAmount: 0,
      plan: {
        ...emptyPaid(),
        allocations: [
          {
            platform: 'META',
            objective: 'TRAFFIC',
            share_pct: 100,
            info_class: 'USER_AUTHORED',
            source: 'MANUAL',
            evidence_refs: [],
          },
        ],
        audiences: [
          {
            key: 'primary',
            name: 'Buyers',
            targeting: { locations: [], languages: [], interests: [] },
            info_class: 'USER_AUTHORED',
            source: 'MANUAL',
            evidence_refs: [],
          },
        ],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.blockingReasons).toContain('PAID_BUDGET_REQUIRED');
  });

  it('blocks when allocations do not sum to 100%', () => {
    const result = evaluatePaidPlanForSubmit({
      paidEnabled: true,
      budgetAmount: 1000,
      plan: {
        allocations: [
          {
            platform: 'META',
            objective: 'TRAFFIC',
            share_pct: 60,
            info_class: 'USER_AUTHORED',
            source: 'MANUAL',
            evidence_refs: [],
          },
        ],
        audiences: [
          {
            key: 'primary',
            name: 'Buyers',
            targeting: { locations: [], languages: [], interests: [] },
            info_class: 'USER_AUTHORED',
            source: 'MANUAL',
            evidence_refs: [],
          },
        ],
        experiments: [],
      },
    });
    expect(result.blockingReasons).toContain('PAID_ALLOCATION_NOT_100');
  });
});
