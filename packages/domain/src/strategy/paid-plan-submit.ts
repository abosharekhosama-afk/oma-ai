import { paidPlanIssues, type PaidPlanInput } from './tracks-v2';

export type PaidPlanSubmitInput = {
  paidEnabled: boolean;
  budgetAmount: number | null;
  plan: PaidPlanInput;
};

export function evaluatePaidPlanForSubmit(input: PaidPlanSubmitInput): {
  ok: boolean;
  blockingReasons: string[];
} {
  if (!input.paidEnabled) {
    return { ok: true, blockingReasons: [] };
  }
  const blockingReasons: string[] = [];
  if (
    input.budgetAmount == null ||
    !Number.isFinite(input.budgetAmount) ||
    input.budgetAmount <= 0
  ) {
    blockingReasons.push('PAID_BUDGET_REQUIRED');
  }
  if (input.plan.allocations.length === 0) {
    blockingReasons.push('PAID_ALLOCATIONS_REQUIRED');
  }
  if (input.plan.audiences.length === 0) {
    blockingReasons.push('PAID_AUDIENCE_REQUIRED');
  }
  for (const issue of paidPlanIssues(input.plan)) {
    if (issue.code === 'ALLOCATION_NOT_100') {
      blockingReasons.push('PAID_ALLOCATION_NOT_100');
    }
    if (issue.code === 'DUPLICATE_ALLOCATION') {
      blockingReasons.push('PAID_DUPLICATE_ALLOCATION');
    }
    if (issue.code === 'DUPLICATE_AUDIENCE_KEY') {
      blockingReasons.push('PAID_DUPLICATE_AUDIENCE');
    }
    if (issue.code === 'AGE_RANGE_INVALID') {
      blockingReasons.push('PAID_AUDIENCE_AGE_INVALID');
    }
    if (issue.code === 'UNKNOWN_AUDIENCE') {
      blockingReasons.push('PAID_EXPERIMENT_AUDIENCE_UNKNOWN');
    }
    if (issue.code === 'DUPLICATE_VARIANT') {
      blockingReasons.push('PAID_EXPERIMENT_VARIANT_INVALID');
    }
  }
  return { ok: blockingReasons.length === 0, blockingReasons };
}
