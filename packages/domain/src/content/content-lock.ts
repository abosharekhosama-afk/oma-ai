import { DomainError } from '../errors';
import type { ApprovalPolicy, ApprovalState } from './states';

/**
 * Approval lock and approval integrity (DEC-025).
 *
 * "What was approved is what gets published." Every server path that changes
 * what a post publishes (copy, media, channel, publish targets, preferred
 * audience, sync-group structure) goes through `decideContentMutation`:
 *
 * - APPROVED + lockAfterApproval      → 409 `error.content_locked`. Unlock only via
 *   `POST /content/:id/reopen` or request-changes (both audited, reason required).
 * - APPROVED, lock off, policy ≠ NONE → the edit is allowed and the approval resets
 *   to NOT_REQUESTED (audited as `content.approval_reset_on_edit`).
 * - PARTIALLY_APPROVED                → the edit is allowed and collected approvals
 *   reset to 0 (state back to PENDING, new round): approvers must see the final version.
 *
 * Planning metadata (planned date, labels, client visibility, campaign, track)
 * never counts as a publishable change and stays editable while locked.
 */
export const LOCKED_CONTENT_FIELDS = [
  'title',
  'caption',
  'media',
  'channel',
  'publish_targets',
  'preferred_audience',
  'sync_group',
] as const;
export type LockedContentField = (typeof LOCKED_CONTENT_FIELDS)[number];

export type ContentLockInput = {
  approvalState: ApprovalState | string;
  approverApproved: number;
  policy: ApprovalPolicy;
  lockAfterApproval: boolean;
};

export type ApprovalResetData = {
  approvalState: 'NOT_REQUESTED' | 'PENDING';
  approverApproved: 0;
  /** A restarted review opens a new round, so earlier per-level decisions no longer count. */
  approvalRoundStartedAt?: Date;
};

export type ContentMutationDecision =
  | { kind: 'allow' }
  | { kind: 'locked'; fields: LockedContentField[] }
  | {
      kind: 'reset';
      from: 'APPROVED' | 'PARTIALLY_APPROVED';
      fields: LockedContentField[];
      data: ApprovalResetData;
      /** True when the reset must also take the post off the publish schedule. */
      unschedule: boolean;
    };

export function isContentLocked(input: {
  approvalState: ApprovalState | string;
  lockAfterApproval: boolean;
}): boolean {
  return input.approvalState === 'APPROVED' && input.lockAfterApproval;
}

export function decideContentMutation(
  input: ContentLockInput,
  fields: readonly LockedContentField[],
  now: Date = new Date(),
): ContentMutationDecision {
  const touched = [...new Set(fields)].filter((f) =>
    (LOCKED_CONTENT_FIELDS as readonly string[]).includes(f),
  );
  if (!touched.length) return { kind: 'allow' };
  if (input.approvalState === 'APPROVED') {
    if (input.lockAfterApproval) return { kind: 'locked', fields: touched };
    if (input.policy === 'NONE') return { kind: 'allow' };
    return {
      kind: 'reset',
      from: 'APPROVED',
      fields: touched,
      data: { approvalState: 'NOT_REQUESTED', approverApproved: 0 },
      // Under REQUIRED the post can no longer publish; take it off the schedule
      // (it stays Planned) instead of letting the worker skip it later.
      unschedule: input.policy === 'REQUIRED',
    };
  }
  if (input.approvalState === 'PARTIALLY_APPROVED') {
    return {
      kind: 'reset',
      from: 'PARTIALLY_APPROVED',
      fields: touched,
      data: { approvalState: 'PENDING', approverApproved: 0, approvalRoundStartedAt: now },
      unschedule: false,
    };
  }
  return { kind: 'allow' };
}

export function contentLockedError(fields: readonly LockedContentField[]): DomainError {
  return new DomainError(
    'CONTENT_LOCKED',
    'Approved content is locked. Reopen it or request changes before editing.',
    409,
    'error.content_locked',
    [{ fields: [...fields] }],
  );
}

/** Throws `error.content_locked` (409) when the decision is `locked`. */
export function assertContentMutable(
  input: ContentLockInput,
  fields: readonly LockedContentField[],
): ContentMutationDecision {
  const decision = decideContentMutation(input, fields);
  if (decision.kind === 'locked') throw contentLockedError(decision.fields);
  return decision;
}

export const REOPEN_REASON_MAX = 1000;

/** Validate the required reason for reopen / unlock. */
export function parseReopenReason(raw: unknown): string {
  const text =
    typeof raw === 'string'
      ? raw
      : raw && typeof raw === 'object' && typeof (raw as { en?: unknown }).en === 'string'
        ? (raw as { en: string }).en
        : '';
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > REOPEN_REASON_MAX) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'A reason (1-1000 characters) is required to reopen approved content',
      400,
      'error.reopen_reason_required',
    );
  }
  return trimmed;
}
