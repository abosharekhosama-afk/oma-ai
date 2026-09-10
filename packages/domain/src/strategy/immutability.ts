import type { StrategyVersionStatus } from './states';

const FROZEN: ReadonlySet<StrategyVersionStatus> = new Set([
  'IN_REVIEW',
  'APPROVED',
  'SUPERSEDED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'ARCHIVED',
]);

export function isVersionContentFrozen(status: StrategyVersionStatus): boolean {
  return FROZEN.has(status);
}

export function canPatchVersionContent(status: StrategyVersionStatus): boolean {
  return status === 'DRAFT';
}

export function mustReviseToEdit(status: StrategyVersionStatus): boolean {
  return isVersionContentFrozen(status) && status !== 'ARCHIVED';
}
