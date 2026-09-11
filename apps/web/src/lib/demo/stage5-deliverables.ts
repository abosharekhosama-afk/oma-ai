import type { DemoGraph, DemoReviewStatus } from '@oma/demo';

export type DeliverableRow = DemoGraph['deliverables'][number];

export type DeliverableFilters = {
  q: string;
  status: string;
  reviewState: string;
  assetType: string;
  campaignId: string;
  contentId: string;
  taskId: string;
  owner: string;
  reviewer: string;
  due: 'all' | 'overdue' | 'soon';
  group: 'all' | 'needs_review' | 'changes' | 'in_progress' | 'approved' | 'archived';
  view: 'list' | 'grid';
};

export const EMPTY_DELIVERABLE_FILTERS: DeliverableFilters = {
  q: '',
  status: 'all',
  reviewState: 'all',
  assetType: 'all',
  campaignId: 'all',
  contentId: 'all',
  taskId: 'all',
  owner: 'all',
  reviewer: 'all',
  due: 'all',
  group: 'all',
  view: 'list',
};

const TODAY = '2026-09-11';

export function deliverableIsOverdue(row: DeliverableRow, today = TODAY): boolean {
  if (row.archived || row.reviewStatus === 'APPROVED' || row.reviewStatus === 'REJECTED') {
    return false;
  }
  return row.dueAt < today;
}

export function unresolvedCount(row: DeliverableRow): number {
  const openPins = row.annotations.filter((a) => !a.resolved).length;
  const openComments = row.comments.filter((c) => !c.resolved).length;
  return openPins + openComments + row.changeRequests.length;
}

export function currentVersion(row: DeliverableRow) {
  return row.versions.find((v) => v.id === row.currentVersionId) ?? row.versions.at(-1) ?? null;
}

export function approvedVersion(row: DeliverableRow) {
  if (!row.approvedVersionId) return null;
  return row.versions.find((v) => v.id === row.approvedVersionId) ?? null;
}

export function deliverableNextAction(row: DeliverableRow): { en: string; ar: string } {
  if (row.archived) return { en: 'Archived', ar: 'مؤرشف' };
  if (row.reviewStatus === 'DRAFT') return { en: 'Submit for review', ar: 'إرسال للمراجعة' };
  if (row.reviewStatus === 'AWAITING_REVIEW' || row.reviewStatus === 'IN_REVIEW') {
    return { en: 'Open review', ar: 'فتح المراجعة' };
  }
  if (row.reviewStatus === 'CHANGES_REQUESTED') {
    return { en: 'Add demo revision', ar: 'إضافة مراجعة تجريبية' };
  }
  if (row.reviewStatus === 'APPROVED') {
    return { en: 'View approved version', ar: 'عرض النسخة المعتمدة' };
  }
  if (row.reviewStatus === 'REJECTED') {
    return { en: 'Create revision', ar: 'إنشاء مراجعة' };
  }
  return { en: 'Open', ar: 'فتح' };
}

export function matchesDeliverableGroup(
  row: DeliverableRow,
  group: DeliverableFilters['group'],
): boolean {
  switch (group) {
    case 'all':
      return true;
    case 'needs_review':
      return (
        !row.archived &&
        (row.reviewStatus === 'AWAITING_REVIEW' || row.reviewStatus === 'IN_REVIEW')
      );
    case 'changes':
      return row.reviewStatus === 'CHANGES_REQUESTED';
    case 'in_progress':
      return row.reviewStatus === 'DRAFT' || row.reviewStatus === 'CHANGES_REQUESTED';
    case 'approved':
      return row.reviewStatus === 'APPROVED';
    case 'archived':
      return row.archived || row.reviewStatus === 'REJECTED';
    default:
      return true;
  }
}

export function filterDeliverables(
  rows: DeliverableRow[],
  filters: DeliverableFilters,
  locale: 'en' | 'ar',
  today = TODAY,
): DeliverableRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (!matchesDeliverableGroup(row, filters.group)) return false;
    if (filters.reviewState !== 'all' && row.reviewStatus !== filters.reviewState) return false;
    if (filters.assetType !== 'all' && row.type !== filters.assetType) return false;
    if (filters.campaignId !== 'all' && row.campaignId !== filters.campaignId) return false;
    if (filters.contentId !== 'all' && row.contentId !== filters.contentId) return false;
    if (filters.taskId !== 'all' && row.taskId !== filters.taskId) return false;
    if (filters.owner !== 'all' && row.owner !== filters.owner) return false;
    if (filters.reviewer !== 'all' && row.reviewer !== filters.reviewer) return false;
    if (filters.due === 'overdue' && !deliverableIsOverdue(row, today)) return false;
    if (filters.due === 'soon' && (deliverableIsOverdue(row, today) || row.dueAt > '2026-09-18')) {
      return false;
    }
    if (!q) return true;
    const ver = currentVersion(row);
    const hay = [
      row.title[locale],
      row.title.en,
      row.type,
      row.owner,
      row.reviewer,
      row.reviewStatus,
      ver?.label ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function activeDeliverableFilterCount(filters: DeliverableFilters): number {
  let n = 0;
  if (filters.q.trim()) n += 1;
  if (filters.reviewState !== 'all') n += 1;
  if (filters.assetType !== 'all') n += 1;
  if (filters.campaignId !== 'all') n += 1;
  if (filters.contentId !== 'all') n += 1;
  if (filters.taskId !== 'all') n += 1;
  if (filters.owner !== 'all') n += 1;
  if (filters.reviewer !== 'all') n += 1;
  if (filters.due !== 'all') n += 1;
  if (filters.group !== 'all') n += 1;
  return n;
}

export type ReviewQueueTab = 'assigned' | 'waiting' | 'changes' | 'approved' | 'all';

export function filterReviewQueue(
  rows: DeliverableRow[],
  tab: ReviewQueueTab,
  reviewerName = 'Layla Haddad',
): DeliverableRow[] {
  const sorted = [...rows].sort((a, b) => {
    const rank = (s: DemoReviewStatus) =>
      s === 'AWAITING_REVIEW' ? 0 : s === 'IN_REVIEW' ? 1 : s === 'CHANGES_REQUESTED' ? 2 : 3;
    return rank(a.reviewStatus) - rank(b.reviewStatus) || a.dueAt.localeCompare(b.dueAt);
  });
  switch (tab) {
    case 'assigned':
      return sorted.filter(
        (r) =>
          r.reviewer === reviewerName &&
          (r.reviewStatus === 'AWAITING_REVIEW' || r.reviewStatus === 'IN_REVIEW'),
      );
    case 'waiting':
      return sorted.filter(
        (r) => r.reviewStatus === 'AWAITING_REVIEW' || r.reviewStatus === 'IN_REVIEW',
      );
    case 'changes':
      return sorted.filter((r) => r.reviewStatus === 'CHANGES_REQUESTED');
    case 'approved':
      return sorted.filter((r) => r.reviewStatus === 'APPROVED');
    case 'all':
    default:
      return sorted.filter((r) => !r.archived);
  }
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function mapClientToNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
  return {
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function mapNormalizedToPercent(x: number, y: number): { left: string; top: string } {
  return { left: `${clamp01(x) * 100}%`, top: `${clamp01(y) * 100}%` };
}

export const REVIEW_TRANSITIONS: Record<DemoReviewStatus, DemoReviewStatus[]> = {
  DRAFT: ['AWAITING_REVIEW'],
  AWAITING_REVIEW: ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'DRAFT'],
  IN_REVIEW: ['CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'AWAITING_REVIEW'],
  CHANGES_REQUESTED: ['DRAFT', 'AWAITING_REVIEW'],
  APPROVED: [],
  REJECTED: ['DRAFT', 'AWAITING_REVIEW'],
};

export function canTransitionReview(from: DemoReviewStatus, to: DemoReviewStatus): boolean {
  if (from === to) return true;
  return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}
