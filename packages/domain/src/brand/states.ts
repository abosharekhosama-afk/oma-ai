export const BRAND_WORKSPACE_STATUSES = ['DRAFT', 'READY_TO_SCAN', 'ACTIVE', 'ARCHIVED'] as const;
export type BrandWorkspaceStatus = (typeof BRAND_WORKSPACE_STATUSES)[number];

export const SCAN_ATTEMPT_STATUSES = [
  'QUEUED',
  'CRAWLING',
  'EXTRACTING',
  'ANALYZING',
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
] as const;
export type ScanAttemptStatus = (typeof SCAN_ATTEMPT_STATUSES)[number];

export const TERMINAL_SCAN_STATUSES: readonly ScanAttemptStatus[] = [
  'SUCCEEDED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
];

export const PROFILE_VERSION_STATUSES = [
  'DRAFT',
  'NEEDS_REVIEW',
  'APPROVED',
  'SUPERSEDED',
  'REJECTED',
] as const;
export type ProfileVersionStatus = (typeof PROFILE_VERSION_STATUSES)[number];

export const INSIGHT_REVIEW_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'EDITED'] as const;
export type InsightReviewStatus = (typeof INSIGHT_REVIEW_STATUSES)[number];

export const INFO_STATES = [
  'OBSERVED',
  'AI_INFERRED',
  'USER_CONFIRMED',
  'USER_CORRECTED',
  'STALE',
] as const;
export type InfoState = (typeof INFO_STATES)[number];

export const AI_AVAILABILITY_VALUES = ['NOT_CONFIGURED', 'UNAVAILABLE', 'USED', 'SKIPPED'] as const;
export type AiAvailability = (typeof AI_AVAILABILITY_VALUES)[number];

export function isTerminalScanStatus(status: ScanAttemptStatus): boolean {
  return (TERMINAL_SCAN_STATUSES as readonly string[]).includes(status);
}

export function canMutateBrand(status: BrandWorkspaceStatus): boolean {
  return status !== 'ARCHIVED';
}

export function canEditProfile(status: ProfileVersionStatus): boolean {
  return status === 'DRAFT' || status === 'NEEDS_REVIEW';
}

export function canApproveProfile(status: ProfileVersionStatus): boolean {
  return status === 'NEEDS_REVIEW';
}
