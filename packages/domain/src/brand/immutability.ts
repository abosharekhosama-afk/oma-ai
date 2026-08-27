import type { ProfileVersionStatus } from './states';

export function isApprovedImmutable(status: ProfileVersionStatus): boolean {
  return status === 'APPROVED' || status === 'SUPERSEDED';
}

export function shouldCreateLateDraft(approvedVersionId: string | null | undefined): boolean {
  return Boolean(approvedVersionId);
}

export function canMutateApprovedContent(status: ProfileVersionStatus): boolean {
  return !isApprovedImmutable(status);
}
