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

export function canScheduleItem(
  item: ContentLifecycleSource,
  policy: 'NONE' | 'OPTIONAL' | 'REQUIRED' = 'OPTIONAL',
): boolean {
  if (item.scheduleBlocked) return false;
  if (policy === 'REQUIRED') {
    return item.approvalState === 'APPROVED';
  }
  // OPTIONAL / NONE: allow schedule unless explicitly blocked
  return item.approvalState !== 'REJECTED';
}

export function canMarkPublished(item: ContentLifecycleSource): boolean {
  return item.approvalState === 'APPROVED' || item.scheduleState === 'SCHEDULED';
}

export function canArchive(item: ContentLifecycleSource): boolean {
  return !item.archivedAt;
}

export function lifecycleHint(
  action: string,
  item: ContentLifecycleSource,
  isAr: boolean,
): string | null {
  if (action === 'approve' && !canApprove(item)) {
    return isAr ? 'يجب أن يكون المنشور قيد المراجعة أولاً' : 'Post must be in review first';
  }
  if (
    action === 'schedule' &&
    !canScheduleItem(item, 'REQUIRED') &&
    item.approvalState !== 'APPROVED'
  ) {
    return isAr
      ? 'الجدولة محظورة حتى اعتماد المنشور بالكامل'
      : 'Scheduling is blocked until content is fully approved';
  }
  if (action === 'request' && !canRequestApproval(item)) {
    return isAr
      ? 'لا يمكن طلب الموافقة في الحالة الحالية'
      : 'Cannot request approval in current state';
  }
  return null;
}
