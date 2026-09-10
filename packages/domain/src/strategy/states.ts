export const STRATEGY_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type StrategyStatus = (typeof STRATEGY_STATUSES)[number];

export const STRATEGY_VERSION_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'SUPERSEDED',
  'ARCHIVED',
] as const;
export type StrategyVersionStatus = (typeof STRATEGY_VERSION_STATUSES)[number];

export const STRATEGY_AI_AVAILABILITIES = ['NOT_CONFIGURED', 'UNAVAILABLE', 'REFUSED'] as const;
export type StrategyAiAvailability = (typeof STRATEGY_AI_AVAILABILITIES)[number];

export const STRATEGY_INFO_CLASSES = [
  'BRAND_LINKED',
  'USER_AUTHORED',
  'ASSUMPTION',
  'UNKNOWN',
  'RECOMMENDATION',
  'AI_PROPOSAL',
] as const;
export type StrategyInfoClass = (typeof STRATEGY_INFO_CLASSES)[number];

export const STRATEGY_KPI_APPLIES_TO = ['STRATEGY', 'ORGANIC', 'PAID'] as const;
export type StrategyKpiAppliesTo = (typeof STRATEGY_KPI_APPLIES_TO)[number];

export const STRATEGY_GAP_KINDS = ['RISK', 'ASSUMPTION', 'DEPENDENCY', 'UNKNOWN'] as const;
export type StrategyGapKind = (typeof STRATEGY_GAP_KINDS)[number];

export const STRATEGY_REVIEW_ACTIONS = [
  'SUBMIT',
  'COMMENT',
  'REQUEST_CHANGES',
  'APPROVE_PACKAGE',
  'REJECT',
  'ARCHIVE',
] as const;
export type StrategyReviewAction = (typeof STRATEGY_REVIEW_ACTIONS)[number];

export function canArchiveStrategy(status: StrategyStatus): boolean {
  return status === 'ACTIVE';
}

export function assertStrategyStatus(value: string): asserts value is StrategyStatus {
  if (!(STRATEGY_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid strategy status: ${value}`);
  }
}

export function assertStrategyVersionStatus(value: string): asserts value is StrategyVersionStatus {
  if (!(STRATEGY_VERSION_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid strategy version status: ${value}`);
  }
}
