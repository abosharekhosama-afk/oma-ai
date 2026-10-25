import type { DemoGraph, DemoTaskStatus } from '@oma/demo';
import { addDays, todayKey } from '../calendar-today';

export type TaskRow = DemoGraph['tasks'][number] & {
  /** Production (ops API) extras — absent on pure demo-graph rows. */
  assigneeUserId?: string | null;
  brandName?: string;
  campaignName?: { en: string; ar: string } | string | null;
  commentCount?: number;
  checklistTotal?: number;
  checklistDone?: number;
};

export type TaskFilters = {
  q: string;
  status: string;
  assignee: string;
  priority: string;
  brandId: string;
  campaignId: string;
  requestId: string;
  contentType: string;
  due: 'all' | 'overdue' | 'soon';
  sort: 'due' | 'priority' | 'updated' | 'title';
};

export const EMPTY_TASK_FILTERS: TaskFilters = {
  q: '',
  status: 'all',
  assignee: 'all',
  priority: 'all',
  brandId: 'all',
  campaignId: 'all',
  requestId: 'all',
  contentType: 'all',
  due: 'all',
  sort: 'due',
};

/** Canonical board columns (OVERDUE surfaces inside In Progress with badge). */
export const BOARD_COLUMNS: Array<{ id: DemoTaskStatus; statuses: DemoTaskStatus[] }> = [
  { id: 'BACKLOG', statuses: ['BACKLOG'] },
  { id: 'READY', statuses: ['READY'] },
  { id: 'IN_PROGRESS', statuses: ['IN_PROGRESS', 'OVERDUE'] },
  { id: 'IN_REVIEW', statuses: ['IN_REVIEW'] },
  { id: 'BLOCKED', statuses: ['BLOCKED'] },
  { id: 'DONE', statuses: ['DONE'] },
];

export function taskIsOverdue(task: TaskRow, today = todayKey()): boolean {
  if (task.status === 'DONE') return false;
  return task.status === 'OVERDUE' || (Boolean(task.dueAt) && task.dueAt < today);
}

/** Due within the next `days` (inclusive), not overdue and not done. */
export function taskIsDueSoon(task: TaskRow, today = todayKey(), days = 3): boolean {
  if (!task.dueAt || task.status === 'DONE' || taskIsOverdue(task, today)) return false;
  return task.dueAt >= today && task.dueAt.slice(0, 10) <= addDays(today, days);
}

export function checklistProgress(task: TaskRow): { done: number; total: number; pct: number } {
  const total = task.checklist.length;
  const done = task.checklist.filter((c) => c.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function groupTasksByBoard(tasks: TaskRow[]): Record<string, TaskRow[]> {
  const map: Record<string, TaskRow[]> = Object.fromEntries(
    BOARD_COLUMNS.map((c) => [c.id, [] as TaskRow[]]),
  );
  for (const task of tasks) {
    const col = BOARD_COLUMNS.find((c) => c.statuses.includes(task.status));
    if (col) map[col.id]!.push(task);
  }
  return map;
}

export function filterTasks(
  rows: TaskRow[],
  filters: TaskFilters,
  locale: 'en' | 'ar',
  today = todayKey(),
): TaskRow[] {
  const soonHorizon = addDays(today, 7);
  const q = filters.q.trim().toLowerCase();
  let next = rows.filter((row) => {
    if (filters.status !== 'all') {
      if (filters.status === 'IN_PROGRESS') {
        if (row.status !== 'IN_PROGRESS' && row.status !== 'OVERDUE') return false;
      } else if (row.status !== filters.status) return false;
    }
    if (filters.assignee === 'unassigned' && row.assignee !== 'Unassigned') return false;
    if (
      filters.assignee !== 'all' &&
      filters.assignee !== 'unassigned' &&
      row.assignee !== filters.assignee
    ) {
      return false;
    }
    if (filters.priority !== 'all' && row.priority !== filters.priority) return false;
    if (filters.brandId !== 'all' && row.brandId !== filters.brandId) return false;
    if (filters.campaignId !== 'all' && row.campaignId !== filters.campaignId) return false;
    if (filters.requestId !== 'all' && row.requestId !== filters.requestId) return false;
    if (filters.contentType !== 'all' && row.type !== filters.contentType) return false;
    if (filters.due === 'overdue' && !taskIsOverdue(row, today)) return false;
    if (
      filters.due === 'soon' &&
      (taskIsOverdue(row, today) || !row.dueAt || row.dueAt > soonHorizon)
    ) {
      return false;
    }
    if (!q) return true;
    const hay = [row.title[locale], row.title.en, row.assignee, row.status, row.type]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  next = [...next].sort((a, b) => {
    switch (filters.sort) {
      case 'priority':
        return (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      case 'updated':
        return b.updatedAt.localeCompare(a.updatedAt);
      case 'title':
        return a.title[locale].localeCompare(b.title[locale]);
      case 'due':
      default:
        return a.dueAt.localeCompare(b.dueAt);
    }
  });
  return next;
}

export function activeTaskFilterCount(filters: TaskFilters): number {
  let n = 0;
  if (filters.q.trim()) n += 1;
  if (filters.status !== 'all') n += 1;
  if (filters.assignee !== 'all') n += 1;
  if (filters.priority !== 'all') n += 1;
  if (filters.brandId !== 'all') n += 1;
  if (filters.campaignId !== 'all') n += 1;
  if (filters.requestId !== 'all') n += 1;
  if (filters.contentType !== 'all') n += 1;
  if (filters.due !== 'all') n += 1;
  return n;
}

export const TASK_STATUS_TRANSITIONS: Record<DemoTaskStatus, DemoTaskStatus[]> = {
  BACKLOG: ['READY', 'IN_PROGRESS'],
  READY: ['BACKLOG', 'IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['READY', 'BLOCKED', 'IN_REVIEW', 'DONE', 'OVERDUE'],
  BLOCKED: ['IN_PROGRESS', 'READY', 'BACKLOG'],
  IN_REVIEW: ['IN_PROGRESS', 'DONE', 'BLOCKED'],
  DONE: ['BACKLOG'],
  OVERDUE: ['IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'],
};

export function canTransitionTaskStatus(from: DemoTaskStatus, to: DemoTaskStatus): boolean {
  if (from === to) return true;
  return TASK_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function productionSummary(tasks: TaskRow[], today = todayKey()) {
  const soonHorizon = addDays(today, 7);
  return {
    wip: tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'OVERDUE').length,
    dueSoon: tasks.filter(
      (t) =>
        !taskIsOverdue(t, today) &&
        Boolean(t.dueAt) &&
        t.dueAt >= today &&
        t.dueAt <= soonHorizon &&
        t.status !== 'DONE',
    ).length,
    blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
    awaitingReview: tasks.filter((t) => t.status === 'IN_REVIEW').length,
  };
}
