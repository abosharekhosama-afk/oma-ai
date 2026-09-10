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
  if (
    input.approvedVersionStatus &&
    input.approvedVersionStatus !== 'APPROVED'
  ) {
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

export function neverAutoSelectCurrentOnApprove(): true {
  return true;
}

export function neverAutoPickReplacement(): true {
  return true;
}
