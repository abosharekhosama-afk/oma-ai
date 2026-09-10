import type { StrategyVersionStatus } from './states';

export type VersionTransitionCommand =
  | 'create'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'revise'
  | 'supersede'
  | 'archive';

const TRANSITIONS: Record<
  VersionTransitionCommand,
  { from: readonly StrategyVersionStatus[] | 'any'; to: StrategyVersionStatus }
> = {
  create: { from: [], to: 'DRAFT' },
  submit: { from: ['DRAFT'], to: 'IN_REVIEW' },
  approve: { from: ['IN_REVIEW'], to: 'APPROVED' },
  reject: { from: ['IN_REVIEW'], to: 'REJECTED' },
  request_changes: { from: ['IN_REVIEW'], to: 'CHANGES_REQUESTED' },
  revise: { from: ['CHANGES_REQUESTED', 'REJECTED', 'APPROVED'], to: 'DRAFT' },
  supersede: { from: ['APPROVED'], to: 'SUPERSEDED' },
  archive: { from: 'any', to: 'ARCHIVED' },
};

export function canTransitionVersion(
  from: StrategyVersionStatus | null,
  command: VersionTransitionCommand,
): boolean {
  const rule = TRANSITIONS[command];
  if (command === 'create') return from === null;
  if (rule.from === 'any') return from !== null && from !== 'ARCHIVED';
  return from !== null && (rule.from as readonly string[]).includes(from);
}

export function nextVersionStatus(
  from: StrategyVersionStatus | null,
  command: VersionTransitionCommand,
): StrategyVersionStatus {
  if (!canTransitionVersion(from, command)) {
    throw new Error(`Invalid transition ${String(from)} -> ${command}`);
  }
  return TRANSITIONS[command].to;
}

export function reviseSourceAllowed(status: StrategyVersionStatus): boolean {
  return canTransitionVersion(status, 'revise');
}
