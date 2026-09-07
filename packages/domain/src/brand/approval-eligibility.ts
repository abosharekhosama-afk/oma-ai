import type { ScanAttemptStatus } from './states';
import { isRequiredForApproval } from './discovery-tiers';

export type ApprovalEligibilityInput = {
  profileStatus: string;
  scanStatus: ScanAttemptStatus;
  requiredFieldsPresent: string[];
  requiredFieldsMissing: string[];
  claimsWithoutEvidence: string[];
  unresolvedAiInferred: string[];
  acknowledgeIncomplete: boolean;
  confirmSummary: boolean;
  isPartialScan: boolean;
};

export type ApprovalEligibilityResult = {
  approvable: boolean;
  blockingReasons: string[];
};

export function evaluateApprovalEligibility(
  input: ApprovalEligibilityInput,
): ApprovalEligibilityResult {
  const blockingReasons: string[] = [];

  if (input.profileStatus !== 'NEEDS_REVIEW') {
    blockingReasons.push('PROFILE_NOT_NEEDS_REVIEW');
  }
  if (input.scanStatus === 'CANCELLED') {
    blockingReasons.push('SCAN_CANCELLED');
  }
  if (input.scanStatus === 'FAILED' && input.requiredFieldsMissing.length > 0) {
    blockingReasons.push('SCAN_FAILED_INSUFFICIENT');
  }
  if (input.requiredFieldsMissing.some((f) => isRequiredForApproval(f))) {
    blockingReasons.push('REQUIRED_FIELDS_MISSING');
  }
  if (input.claimsWithoutEvidence.length > 0) {
    blockingReasons.push('CLAIMS_WITHOUT_EVIDENCE');
  }
  if (input.unresolvedAiInferred.length > 0) {
    blockingReasons.push('UNRESOLVED_AI_INFERRED');
  }
  if (input.isPartialScan && !input.acknowledgeIncomplete) {
    blockingReasons.push('PARTIAL_ACK_REQUIRED');
  }
  if (!input.confirmSummary) {
    blockingReasons.push('CONFIRM_SUMMARY_REQUIRED');
  }

  return { approvable: blockingReasons.length === 0, blockingReasons };
}
