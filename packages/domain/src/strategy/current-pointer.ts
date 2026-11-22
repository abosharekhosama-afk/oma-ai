import type { StrategyStatus, StrategyVersionStatus } from './states';

export type CurrentPointerEligibilityInput = {
  strategyTenantId: string;
  brandTenantId: string;
  strategyBrandId: string;
  brandId: string;
  strategyStatus: StrategyStatus;
  hasNonSupersededApprovedVersion: boolean;
  approvedVersionStatus?: StrategyVersionStatus | null;
};

export type CurrentPointerEligibilityResult = {
  eligible: boolean;
  blockingReasons: string[];
};

export function evaluateSetCurrentEligibility(
  input: CurrentPointerEligibilityInput,
): CurrentPointerEligibilityResult {
  const blockingReasons: string[] = [];
  if (input.strategyTenantId !== input.brandTenantId) {
    blockingReasons.push('TENANT_MISMATCH');
  }
  if (input.strategyBrandId !== input.brandId) {
    blockingReasons.push('BRAND_MISMATCH');
  }
  if (input.strategyStatus !== 'ACTIVE') {
    blockingReasons.push('STRATEGY_NOT_ACTIVE');
  }
  if (!input.hasNonSupersededApprovedVersion) {
    blockingReasons.push('NO_APPROVED_VERSION');
  }
  if (input.approvedVersionStatus && input.approvedVersionStatus !== 'APPROVED') {
    blockingReasons.push('APPROVED_VERSION_INELIGIBLE');
  }
  return { eligible: blockingReasons.length === 0, blockingReasons };
}

/**
 * Spec §8.4 / DP-003-003 B: archive or ineligibility clears pointer;
 * never auto-select a replacement.
 */
export function shouldClearCurrentOnArchive(
  currentApprovedStrategyId: string | null | undefined,
  archivedStrategyId: string,
): boolean {
  return Boolean(currentApprovedStrategyId) && currentApprovedStrategyId === archivedStrategyId;
}

/**
 * DEC-030: approving a strategy package makes it the brand's current strategy,
 * but only for an approver who may also set the current pointer
 * (`strategy.set_current`). Approve alone never widens what a role can do.
 */
export function shouldAutoSetCurrentOnApprove(input: { actorCanSetCurrent: boolean }): boolean {
  return input.actorCanSetCurrent;
}

export type CurrentCandidate = {
  id: string;
  status: string;
  /** When the strategy's live APPROVED version was approved; null = none. */
  approvedAt: Date | string | null;
};

/**
 * DEC-030: which strategy the brand journey treats as current.
 * The explicit pointer wins when it still points at an ACTIVE strategy with an
 * APPROVED version. Without a usable pointer (older data approved before
 * approve→current existed) the most recently approved ACTIVE strategy is used,
 * flagged `inferred` so nothing is written on read.
 */
export function effectiveCurrentStrategy(input: {
  pointerId: string | null | undefined;
  candidates: CurrentCandidate[];
}): { id: string | null; inferred: boolean } {
  const usable = input.candidates.filter((c) => c.status === 'ACTIVE' && c.approvedAt != null);
  if (input.pointerId && usable.some((c) => c.id === input.pointerId)) {
    return { id: input.pointerId, inferred: false };
  }
  const latest = [...usable].sort(
    (a, b) => new Date(b.approvedAt!).getTime() - new Date(a.approvedAt!).getTime(),
  )[0];
  return latest ? { id: latest.id, inferred: true } : { id: null, inferred: false };
}

export type StrategyDisplayStatus =
  'CURRENT' | 'APPROVED' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'DRAFT' | 'ARCHIVED';

/**
 * One user-facing status per strategy. `Strategy.status` is only ACTIVE/ARCHIVED
 * (a lifecycle flag), so lists must not show it: a draft is a draft.
 */
export function strategyDisplayStatus(input: {
  strategyStatus: string;
  isCurrent: boolean;
  hasApprovedVersion: boolean;
  latestVersionStatus: string | null | undefined;
}): StrategyDisplayStatus {
  if (input.strategyStatus === 'ARCHIVED') return 'ARCHIVED';
  if (input.isCurrent && input.hasApprovedVersion) return 'CURRENT';
  const latest = input.latestVersionStatus ?? 'DRAFT';
  if (latest === 'IN_REVIEW') return 'IN_REVIEW';
  if (latest === 'CHANGES_REQUESTED' || latest === 'REJECTED') return 'CHANGES_REQUESTED';
  if (input.hasApprovedVersion || latest === 'APPROVED') return 'APPROVED';
  return 'DRAFT';
}

export function neverAutoPickReplacement(): true {
  return true;
}
