import type { DemoGraph, DemoLocaleCopy } from '@oma/demo';

export type RequestRow = DemoGraph['requests'][number];
export type BriefRow = DemoGraph['briefs'][number];
export type RequestGroup =
  'all' | 'untriaged' | 'assigned' | 'in_progress' | 'waiting' | 'completed';

export type RequestFilters = {
  q: string;
  status: string;
  priority: string;
  type: string;
  brandId: string;
  campaignId: string;
  requester: string;
  assignee: string;
  due: 'all' | 'overdue' | 'soon' | 'later';
  group: RequestGroup;
};

export const EMPTY_REQUEST_FILTERS: RequestFilters = {
  q: '',
  status: 'all',
  priority: 'all',
  type: 'all',
  brandId: 'all',
  campaignId: 'all',
  requester: 'all',
  assignee: 'all',
  due: 'all',
  group: 'all',
};

const TODAY = '2026-09-11';

export function requestIsOverdue(row: RequestRow, today = TODAY): boolean {
  if (row.status === 'DONE' || row.status === 'CLOSED') return false;
  return row.dueAt < today;
}

export function requestMissingFields(row: RequestRow): string[] {
  const missing: string[] = [];
  if (!row.assignee) missing.push('assignee');
  if (!row.campaignId) missing.push('campaign');
  if (!row.channels?.length) missing.push('channels');
  if (!row.formats?.length) missing.push('formats');
  if (!row.briefId) missing.push('brief');
  return missing;
}

export function requestCompleteness(row: RequestRow, brief: BriefRow | null): number {
  const checks = [
    Boolean(row.title.en.trim()),
    Boolean(row.description.en.trim()),
    Boolean(row.assignee),
    Boolean(row.campaignId),
    Boolean(row.channels?.length),
    Boolean(row.formats?.length),
    Boolean(brief),
    Boolean(brief && brief.objective.en.trim()),
    Boolean(brief && brief.audience.en.trim()),
    Boolean(brief && brief.keyMessage.en.trim()),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function requestNextAction(row: RequestRow, brief: BriefRow | null): DemoLocaleCopy {
  if (row.status === 'OPEN' && !row.assignee) {
    return { en: 'Triage & assign', ar: 'فرز وتعيين' };
  }
  if (row.status === 'WAITING_INFO') {
    return { en: 'Collect missing info', ar: 'جمع المعلومات الناقصة' };
  }
  if (!brief || brief.readiness !== 'READY') {
    return { en: 'Complete brief', ar: 'أكمل الموجز' };
  }
  if (row.status === 'READY_FOR_PRODUCTION' && !row.conversionTaskIds?.length) {
    return { en: 'Convert to tasks', ar: 'حوّل إلى مهام' };
  }
  if (row.status === 'IN_PRODUCTION') {
    return { en: 'Track production', ar: 'تابع الإنتاج' };
  }
  if (row.status === 'DONE' || row.status === 'CLOSED') {
    return { en: 'Closed', ar: 'مغلق' };
  }
  return { en: 'Review request', ar: 'راجع الطلب' };
}

export function matchesRequestGroup(row: RequestRow, group: RequestGroup): boolean {
  switch (group) {
    case 'all':
      return true;
    case 'untriaged':
      return row.status === 'OPEN' && !row.assignee;
    case 'assigned':
      return row.status === 'ASSIGNED' || Boolean(row.assignee && row.status === 'OPEN');
    case 'in_progress':
      return (
        row.status === 'IN_BRIEF' ||
        row.status === 'IN_PRODUCTION' ||
        row.status === 'READY_FOR_PRODUCTION'
      );
    case 'waiting':
      return row.status === 'WAITING_INFO';
    case 'completed':
      return row.status === 'DONE' || row.status === 'CLOSED';
    default:
      return true;
  }
}

export function filterRequests(
  rows: RequestRow[],
  filters: RequestFilters,
  locale: 'en' | 'ar',
  today = TODAY,
): RequestRow[] {
  const q = filters.q.trim().toLowerCase();
  return rows.filter((row) => {
    if (!matchesRequestGroup(row, filters.group)) return false;
    if (filters.status !== 'all' && row.status !== filters.status) return false;
    if (filters.priority !== 'all' && row.priority !== filters.priority) return false;
    if (filters.type !== 'all' && row.type !== filters.type) return false;
    if (filters.brandId !== 'all' && row.brandId !== filters.brandId) return false;
    if (filters.campaignId !== 'all' && row.campaignId !== filters.campaignId) return false;
    if (filters.requester !== 'all' && row.requester !== filters.requester) return false;
    if (filters.assignee === 'unassigned' && row.assignee) return false;
    if (
      filters.assignee !== 'all' &&
      filters.assignee !== 'unassigned' &&
      row.assignee !== filters.assignee
    ) {
      return false;
    }
    if (filters.due === 'overdue' && !requestIsOverdue(row, today)) return false;
    if (filters.due === 'soon' && (requestIsOverdue(row, today) || row.dueAt > '2026-09-18')) {
      return false;
    }
    if (filters.due === 'later' && row.dueAt <= '2026-09-18') return false;
    if (!q) return true;
    const hay = [
      row.title[locale],
      row.title.en,
      row.type,
      row.requester,
      row.assignee ?? '',
      row.status,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function activeRequestFilterCount(filters: RequestFilters): number {
  let n = 0;
  if (filters.q.trim()) n += 1;
  if (filters.status !== 'all') n += 1;
  if (filters.priority !== 'all') n += 1;
  if (filters.type !== 'all') n += 1;
  if (filters.brandId !== 'all') n += 1;
  if (filters.campaignId !== 'all') n += 1;
  if (filters.requester !== 'all') n += 1;
  if (filters.assignee !== 'all') n += 1;
  if (filters.due !== 'all') n += 1;
  if (filters.group !== 'all') n += 1;
  return n;
}

export function briefIsReady(brief: BriefRow): boolean {
  return (
    brief.objective.en.trim().length > 0 &&
    brief.audience.en.trim().length > 0 &&
    brief.keyMessage.en.trim().length > 0 &&
    brief.cta.en.trim().length > 0 &&
    brief.acceptance.en.trim().length > 0 &&
    brief.channels.length > 0 &&
    brief.formats.length > 0
  );
}

export function briefCompleteness(brief: BriefRow): number {
  const checks = [
    brief.overview.en,
    brief.objective.en,
    brief.audience.en,
    brief.keyMessage.en,
    brief.deliverableType.en,
    brief.tone.en,
    brief.mandatory.en,
    brief.cta.en,
    brief.acceptance.en,
    brief.channels.length ? 'x' : '',
    brief.formats.length ? 'x' : '',
  ];
  return Math.round((checks.filter((c) => String(c).trim()).length / checks.length) * 100);
}

export const REQUEST_STATUS_TRANSITIONS: Record<RequestRow['status'], RequestRow['status'][]> = {
  OPEN: ['ASSIGNED', 'WAITING_INFO', 'IN_BRIEF', 'CLOSED'],
  ASSIGNED: ['IN_BRIEF', 'WAITING_INFO', 'READY_FOR_PRODUCTION', 'CLOSED'],
  IN_BRIEF: ['WAITING_INFO', 'READY_FOR_PRODUCTION', 'ASSIGNED', 'CLOSED'],
  WAITING_INFO: ['ASSIGNED', 'IN_BRIEF', 'CLOSED'],
  READY_FOR_PRODUCTION: ['IN_PRODUCTION', 'IN_BRIEF', 'CLOSED'],
  IN_PRODUCTION: ['DONE', 'WAITING_INFO', 'CLOSED'],
  DONE: ['CLOSED'],
  CLOSED: [],
};

export function canTransitionRequestStatus(
  from: RequestRow['status'],
  to: RequestRow['status'],
): boolean {
  if (from === to) return true;
  return REQUEST_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
