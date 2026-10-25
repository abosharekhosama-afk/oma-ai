import { t as tr } from '@oma/i18n';

const L = (isAr: boolean, key: string) => tr(isAr ? 'ar' : 'en', key);
/**
 * Client-side mirrors of domain content workflow rules (Planable-style lifecycle).
 * Used to enable/disable menu actions before hitting the API.
 */

export type ContentLifecycleSource = {
  status?: string;
  approvalState?: string;
  scheduleState?: string;
  scheduleBlocked?: boolean;
  archivedAt?: string | null;
  clientVisible?: boolean;
};

export function canRequestApproval(item: ContentLifecycleSource): boolean {
  const a = item.approvalState || 'NOT_REQUESTED';
  return a === 'NOT_REQUESTED' || a === 'CHANGES_REQUESTED' || a === 'REJECTED' || a === 'APPROVED';
}

export function canApprove(item: ContentLifecycleSource): boolean {
  const a = item.approvalState || 'NOT_REQUESTED';
  return a === 'PENDING' || a === 'PARTIALLY_APPROVED';
}

export function canRequestChanges(item: ContentLifecycleSource): boolean {
  return canApprove(item);
}

export function canReject(item: ContentLifecycleSource): boolean {
  return canApprove(item);
}

export type Policy = 'NONE' | 'OPTIONAL' | 'REQUIRED';

/** Why Schedule is unavailable (mirrors domain `scheduleBlockedReason`). */
export function scheduleBlockReason(
  item: ContentLifecycleSource,
  policy: Policy = 'OPTIONAL',
): 'ARCHIVED' | 'REJECTED' | 'APPROVAL_REQUIRED' | null {
  if (item.archivedAt) return 'ARCHIVED';
  if (item.approvalState === 'REJECTED') return 'REJECTED';
  if (policy === 'REQUIRED' && item.approvalState !== 'APPROVED') return 'APPROVAL_REQUIRED';
  return null;
}

export function canScheduleItem(item: ContentLifecycleSource, policy: Policy = 'OPTIONAL'): boolean {
  return scheduleBlockReason(item, policy) === null;
}

export function canMarkPublished(item: ContentLifecycleSource, policy: Policy = 'OPTIONAL'): boolean {
  if (scheduleBlockReason(item, policy)) return false;
  return item.approvalState === 'APPROVED' || item.scheduleState === 'SCHEDULED' || policy !== 'REQUIRED';
}

/** "1 of 2 approved" style progress label; null when no approval is in flight. */
export function approvalProgressLabel(
  item: ContentLifecycleSource & { approverApproved?: number; approverRequired?: number },
  policy: Policy,
  isAr: boolean,
): string | null {
  if (policy === 'NONE') return null;
  const a = item.approvalState || 'NOT_REQUESTED';
  if (a !== 'PENDING' && a !== 'PARTIALLY_APPROVED' && a !== 'APPROVED') return null;
  const req = Math.max(1, item.approverRequired ?? 1);
  const got = a === 'APPROVED' ? req : Math.min(req, item.approverApproved ?? 0);
  return L(isAr, 'workflow.progress').replace('{a}', String(got)).replace('{r}', String(req));
}

export function scheduleBlockedHint(
  reason: ReturnType<typeof scheduleBlockReason>,
  isAr: boolean,
): string | null {
  if (reason === 'ARCHIVED') return L(isAr, 'workflow.blocked.archived');
  if (reason === 'REJECTED')
    return L(isAr, 'workflow.blocked.rejected');
  if (reason === 'APPROVAL_REQUIRED')
    return L(isAr, 'workflow.blocked.approval');
  return null;
}

export function canArchive(item: ContentLifecycleSource): boolean {
  return !item.archivedAt;
}

export function lifecycleHint(
  action: string,
  item: ContentLifecycleSource,
  isAr: boolean,
  policy: Policy = 'OPTIONAL',
): string | null {
  if (action === 'approve' && !canApprove(item)) {
    return L(isAr, 'workflow.hint.mustBeInReview');
  }
  if (action === 'schedule' || action === 'published') {
    const hint = scheduleBlockedHint(scheduleBlockReason(item, policy), isAr);
    if (hint) return hint;
  }
  if (action === 'request' && !canRequestApproval(item)) {
    return L(isAr, 'workflow.hint.cannotRequest');
  }
  return null;
}
