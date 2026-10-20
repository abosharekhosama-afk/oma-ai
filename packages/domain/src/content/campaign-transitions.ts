import type { CampaignStatus } from './states';

export type CampaignTransitionCommand =
  | 'activate'
  | 'mark_upcoming'
  | 'mark_in_review'
  | 'clear_review'
  | 'needs_attention'
  | 'complete'
  | 'archive';

const TRANSITIONS: Record<
  CampaignTransitionCommand,
  { from: readonly CampaignStatus[]; to: CampaignStatus }
> = {
  mark_upcoming: { from: ['DRAFT', 'ACTIVE'], to: 'UPCOMING' },
  activate: { from: ['DRAFT', 'UPCOMING', 'IN_REVIEW', 'NEEDS_ATTENTION'], to: 'ACTIVE' },
  mark_in_review: { from: ['ACTIVE', 'UPCOMING', 'DRAFT'], to: 'IN_REVIEW' },
  clear_review: { from: ['IN_REVIEW'], to: 'ACTIVE' },
  needs_attention: {
    from: ['ACTIVE', 'IN_REVIEW', 'UPCOMING'],
    to: 'NEEDS_ATTENTION',
  },
  complete: {
    from: ['ACTIVE', 'UPCOMING', 'IN_REVIEW', 'NEEDS_ATTENTION'],
    to: 'COMPLETED',
  },
  archive: {
    from: ['DRAFT', 'UPCOMING', 'ACTIVE', 'IN_REVIEW', 'NEEDS_ATTENTION', 'COMPLETED'],
    to: 'ARCHIVED',
  },
};

export function canTransitionCampaign(
  from: CampaignStatus,
  command: CampaignTransitionCommand,
): boolean {
  if (from === 'ARCHIVED' && command !== 'archive') return false;
  return (TRANSITIONS[command].from as readonly string[]).includes(from);
}

export function applyCampaignTransition(
  from: CampaignStatus,
  command: CampaignTransitionCommand,
): CampaignStatus {
  if (!canTransitionCampaign(from, command)) {
    throw new Error(`Invalid campaign transition ${from} -> ${command}`);
  }
  return TRANSITIONS[command].to;
}

/** Derive a display status hint from content approval activity */
export function deriveCampaignReviewHint(
  contentApprovalStates: string[],
): 'IN_REVIEW' | 'DRAFT' | 'APPROVED' | 'SCHEDULED' | 'CLEAR' {
  if (contentApprovalStates.some((s) => s === 'PENDING' || s === 'PARTIALLY_APPROVED' || s === 'IN_REVIEW')) {
    return 'IN_REVIEW';
  }
  if (contentApprovalStates.some((s) => s === 'DRAFT' || s === 'NOT_REQUESTED' || s === 'CHANGES_REQUESTED')) {
    return 'DRAFT';
  }
  if (contentApprovalStates.some((s) => s === 'APPROVED')) return 'APPROVED';
  if (contentApprovalStates.some((s) => s === 'SCHEDULED')) return 'SCHEDULED';
  return 'CLEAR';
}
