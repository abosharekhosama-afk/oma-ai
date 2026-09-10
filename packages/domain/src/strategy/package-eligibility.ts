import { validateTrackEnablementForSubmit } from './track-enablement';

export type PackageEligibilityInput = {
  linkedApprovedProfileVersionId: string | null | undefined;
  linkedProfileStatus?: string | null;
  organicEnabled: boolean;
  paidEnabled: boolean;
  organicDisabledRationale?: string | null;
  paidDisabledRationale?: string | null;
  requiredFoundationPresent: boolean;
  unknownsAcknowledged: boolean;
  forAction: 'submit' | 'approve';
};

export type PackageEligibilityResult = {
  eligible: boolean;
  blockingReasons: string[];
  evidenceBacked: boolean;
  missingSource: boolean;
};

export function evaluatePackageEligibility(
  input: PackageEligibilityInput,
): PackageEligibilityResult {
  const blockingReasons: string[] = [];
  const missingSource = !input.linkedApprovedProfileVersionId;
  const evidenceBacked =
    Boolean(input.linkedApprovedProfileVersionId) &&
    (input.linkedProfileStatus == null || input.linkedProfileStatus === 'APPROVED');

  if (!input.linkedApprovedProfileVersionId) {
    blockingReasons.push('APPROVED_PROFILE_REQUIRED');
  } else if (input.linkedProfileStatus && input.linkedProfileStatus !== 'APPROVED') {
    blockingReasons.push('LINKED_PROFILE_NOT_APPROVED');
  }

  const tracks = validateTrackEnablementForSubmit({
    organicEnabled: input.organicEnabled,
    paidEnabled: input.paidEnabled,
    organicDisabledRationale: input.organicDisabledRationale,
    paidDisabledRationale: input.paidDisabledRationale,
  });
  blockingReasons.push(...tracks.blockingReasons);

  if (!input.requiredFoundationPresent) {
    blockingReasons.push('REQUIRED_FOUNDATION_FIELDS');
  }
  if (!input.unknownsAcknowledged) {
    blockingReasons.push('UNKNOWNS_ACK_REQUIRED');
  }

  return {
    eligible: blockingReasons.length === 0,
    blockingReasons,
    evidenceBacked,
    missingSource,
  };
}

/** Draft create may omit Approved profile (DP-003-001 B). */
export function draftAllowsMissingApprovedProfile(): boolean {
  return true;
}

export function draftAidNeverSatisfiesGate(): boolean {
  return true;
}
