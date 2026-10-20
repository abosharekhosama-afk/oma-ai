import type { ApprovalState, ContentStatus } from './states';

export type ContentApprovalCommand =
  | 'request_approval'
  | 'approve'
  | 'request_changes'
  | 'reject'
  | 'reset';

type Next = { approvalState: ApprovalState; status: ContentStatus; deltaApproved?: number };

/**
 * Pure transition for content approval.
 * `approverRequired` / `approverApproved` are used for multi-approver flows.
 */
export function applyContentApprovalTransition(input: {
  command: ContentApprovalCommand;
  approvalState: ApprovalState;
  status: ContentStatus;
  approverApproved: number;
  approverRequired: number;
}): Next {
  const { command, approvalState, approverApproved, approverRequired } = input;

  switch (command) {
    case 'request_approval': {
      if (
        approvalState !== 'NOT_REQUESTED' &&
        approvalState !== 'CHANGES_REQUESTED' &&
        approvalState !== 'REJECTED' &&
        approvalState !== 'APPROVED'
      ) {
        // allow re-request from approved (re-review)
      }
      return {
        approvalState: 'PENDING',
        status: 'IN_REVIEW',
        deltaApproved: -approverApproved, // reset counter via absolute set in service
      };
    }
    case 'approve': {
      if (approvalState !== 'PENDING' && approvalState !== 'PARTIALLY_APPROVED') {
        throw new Error(`Cannot approve from ${approvalState}`);
      }
      const nextCount = approverApproved + 1;
      if (nextCount < approverRequired) {
        return {
          approvalState: 'PARTIALLY_APPROVED',
          status: 'IN_REVIEW',
          deltaApproved: 1,
        };
      }
      return {
        approvalState: 'APPROVED',
        status: 'APPROVED',
        deltaApproved: 1,
      };
    }
    case 'request_changes': {
      if (approvalState !== 'PENDING' && approvalState !== 'PARTIALLY_APPROVED') {
        throw new Error(`Cannot request changes from ${approvalState}`);
      }
      return { approvalState: 'CHANGES_REQUESTED', status: 'DRAFT', deltaApproved: -approverApproved };
    }
    case 'reject': {
      if (approvalState !== 'PENDING' && approvalState !== 'PARTIALLY_APPROVED') {
        throw new Error(`Cannot reject from ${approvalState}`);
      }
      return { approvalState: 'REJECTED', status: 'DRAFT', deltaApproved: -approverApproved };
    }
    case 'reset': {
      return { approvalState: 'NOT_REQUESTED', status: 'DRAFT', deltaApproved: -approverApproved };
    }
    default:
      throw new Error(`Unknown command: ${command as string}`);
  }
}

export function nextApproverCount(
  current: number,
  delta: number | undefined,
  required: number,
): number {
  if (delta == null) return current;
  if (delta < 0) return 0; // reset
  return Math.min(required, current + delta);
}
