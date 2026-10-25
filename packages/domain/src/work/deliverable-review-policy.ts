/**
 * Official deliverable review + version policy (production lock).
 *
 * Version policy after `request_changes` (simpler default, 2026-10-24):
 * - `APPROVED` and `REJECTED` always reject `addVersion` with 409.
 * - `AWAITING_REVIEW` and `IN_REVIEW` also reject `addVersion` (default deny;
 *   there is no withdraw action — request changes or finish the review first).
 * - `NOT_STARTED`, `DRAFT`, and `CHANGES_REQUESTED` allow a new version.
 * - A new version is `DRAFT`. Earlier non-approved versions become `SUPERSEDED`.
 * - Adding a version keeps `reviewStatus` unchanged. In particular,
 *   `CHANGES_REQUESTED` stays `CHANGES_REQUESTED` until an explicit `submit`.
 *   It is not reset to `NOT_STARTED` or `DRAFT`.
 * - `approvedVersionId` is never cleared by adding a version. The legal machine
 *   cannot `request_changes` after `APPROVED`, so the first approval stays pinned.
 */

export const DELIVERABLE_REVIEW_ACTIONS = [
  'submit',
  'approve',
  'request_changes',
  'reject',
] as const;

export type DeliverableReviewAction = (typeof DELIVERABLE_REVIEW_ACTIONS)[number];

export type DeliverableReviewStep = {
  next: string;
  status: string;
};

const TRANSITIONS: Record<string, { next: string; status: string }> = {
  submit: { next: 'AWAITING_REVIEW', status: 'IN_REVIEW' },
  approve: { next: 'APPROVED', status: 'APPROVED' },
  request_changes: { next: 'CHANGES_REQUESTED', status: 'CHANGES_REQUESTED' },
  reject: { next: 'REJECTED', status: 'REJECTED' },
};

const ALLOWED_FROM: Record<string, readonly DeliverableReviewAction[]> = {
  NOT_STARTED: ['submit'],
  DRAFT: ['submit'],
  AWAITING_REVIEW: ['approve', 'request_changes', 'reject'],
  IN_REVIEW: ['approve', 'request_changes', 'reject'],
  CHANGES_REQUESTED: ['submit'],
  APPROVED: [],
  REJECTED: [],
};

const VERSION_CREATE_ALLOWED = new Set(['NOT_STARTED', 'DRAFT', 'CHANGES_REQUESTED']);

export function normalizeReviewAction(action: string): string {
  return action.trim().toLowerCase().replace(/-/g, '_');
}

export function normalizeReviewStatus(status: string | null | undefined): string {
  const key = (status || 'NOT_STARTED').toUpperCase();
  return key in ALLOWED_FROM ? key : 'NOT_STARTED';
}

export function reviewStep(
  fromStatus: string | null | undefined,
  action: string,
): DeliverableReviewStep | 'UNKNOWN_ACTION' | 'ILLEGAL' {
  const normalized = normalizeReviewAction(action);
  const step = TRANSITIONS[normalized];
  if (!step) return 'UNKNOWN_ACTION';
  const from = normalizeReviewStatus(fromStatus);
  if (!(ALLOWED_FROM[from] || []).includes(normalized as DeliverableReviewAction)) return 'ILLEGAL';
  return step;
}

export function versionCreateAllowed(reviewStatus: string | null | undefined): boolean {
  return VERSION_CREATE_ALLOWED.has(normalizeReviewStatus(reviewStatus));
}

/**
 * Status to persist on the deliverable after a legal version create.
 * Simpler default: keep the current review status (including CHANGES_REQUESTED).
 */
export function reviewStatusAfterVersionCreate(reviewStatus: string | null | undefined): string {
  return normalizeReviewStatus(reviewStatus);
}
