export type BudgetLimits = {
  monthlyUsd: number;
  dailyUsd: number;
  maxInputTokens: number | null;
  maxOutputTokens: number | null;
};

export type BudgetSnapshot = {
  monthlySpentUsd: number;
  dailySpentUsd: number;
  monthlyReservedUsd: number;
  dailyReservedUsd: number;
};

export type BudgetDecision =
  | { ok: true; warning: boolean; utilization: number }
  | { ok: false; code: 'BUDGET_EXCEEDED'; scope: 'monthly' | 'daily' | 'tokens' };

const WARNING_RATIO = 0.8;

export function evaluateBudget(input: {
  limits: BudgetLimits;
  snapshot: BudgetSnapshot;
  reserveUsd: number;
  inputTokens: number;
  outputTokens: number;
}): BudgetDecision {
  if (input.limits.maxInputTokens != null && input.inputTokens > input.limits.maxInputTokens) {
    return { ok: false, code: 'BUDGET_EXCEEDED', scope: 'tokens' };
  }
  if (input.limits.maxOutputTokens != null && input.outputTokens > input.limits.maxOutputTokens) {
    return { ok: false, code: 'BUDGET_EXCEEDED', scope: 'tokens' };
  }
  const month =
    input.snapshot.monthlySpentUsd + input.snapshot.monthlyReservedUsd + input.reserveUsd;
  const day = input.snapshot.dailySpentUsd + input.snapshot.dailyReservedUsd + input.reserveUsd;
  if (month > input.limits.monthlyUsd) {
    return { ok: false, code: 'BUDGET_EXCEEDED', scope: 'monthly' };
  }
  if (day > input.limits.dailyUsd) {
    return { ok: false, code: 'BUDGET_EXCEEDED', scope: 'daily' };
  }
  const utilization = input.limits.monthlyUsd > 0 ? month / input.limits.monthlyUsd : 1;
  return { ok: true, warning: utilization >= WARNING_RATIO, utilization };
}
