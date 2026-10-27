import { resolveContentWorkflow, type DemoGraph } from '@oma/demo';

export type ContentRow = DemoGraph['contentItems'][number];
export type DeliverableRow = DemoGraph['deliverables'][number];
export type TaskRow = DemoGraph['tasks'][number];

export type ContentFilters = {
  query: string;
  campaignId: string;
  /** Empty = all brands. Multi-select brand ids. */
  brandIds: string[];
  channel: string;
  contentType: string;
  status: string;
  review: string;
  approval: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_CONTENT_FILTERS: ContentFilters = {
  query: '',
  campaignId: 'all',
  brandIds: [],
  channel: 'all',
  contentType: 'all',
  status: 'all',
  review: 'all',
  approval: 'all',
  assignee: 'all',
  dateFrom: '',
  dateTo: '',
};

export type ContentViewMode = 'calendar' | 'feed' | 'list' | 'grid';

/** One preview card in the cell; remaining posts open via "+N more". */
export const MAX_CELL_ITEMS = 1;

export function filterContent(
  items: ContentRow[],
  filters: ContentFilters,
  locale: string,
): ContentRow[] {
  const q = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.campaignId !== 'all' && item.campaignId !== filters.campaignId) return false;
    if (filters.brandIds.length && !filters.brandIds.includes(item.brandId)) return false;
    if (filters.channel !== 'all' && item.channel !== filters.channel) return false;
    if (filters.contentType !== 'all' && item.contentType !== filters.contentType) return false;
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.assignee !== 'all' && item.assignee !== filters.assignee) return false;
    if (filters.review === 'needs' && item.status !== 'IN_REVIEW') return false;
    if (filters.review === 'approved' && item.status !== 'APPROVED') return false;
    if (filters.approval !== 'all') {
      const approval = resolveContentWorkflow(item).approvalState;
      if (approval !== filters.approval) return false;
    }
    if (filters.dateFrom || filters.dateTo) {
      if (!item.scheduledAt) return false;
      const day = item.scheduledAt.slice(0, 10);
      if (filters.dateFrom && day < filters.dateFrom) return false;
      if (filters.dateTo && day > filters.dateTo) return false;
    }
    if (q) {
      const title = locale.toLowerCase().startsWith('ar') ? item.title.ar : item.title.en;
      const hay = `${title} ${item.channel} ${item.assignee} ${item.status}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function activeContentFilterCount(filters: ContentFilters): number {
  let n = 0;
  if (filters.query.trim()) n += 1;
  if (filters.campaignId !== 'all') n += 1;
  if (filters.brandIds.length) n += 1;
  if (filters.channel !== 'all') n += 1;
  if (filters.contentType !== 'all') n += 1;
  if (filters.status !== 'all') n += 1;
  if (filters.review !== 'all') n += 1;
  if (filters.approval !== 'all') n += 1;
  if (filters.assignee !== 'all') n += 1;
  if (filters.dateFrom) n += 1;
  if (filters.dateTo) n += 1;
  return n;
}

export type NamedFilterChip = { id: string; label: string };

export function contentFilterChips(
  filters: ContentFilters,
  labels: {
    campaign: (id: string) => string;
    brand: (id: string) => string;
    status: (id: string) => string;
    review: (id: string) => string;
    contentType?: (id: string) => string;
    approval?: (id: string) => string;
  },
): NamedFilterChip[] {
  const chips: NamedFilterChip[] = [];
  if (filters.query.trim()) chips.push({ id: 'query', label: filters.query.trim() });
  if (filters.campaignId !== 'all') {
    chips.push({ id: 'campaignId', label: labels.campaign(filters.campaignId) });
  }
  for (const id of filters.brandIds) {
    chips.push({ id: `brand:${id}`, label: labels.brand(id) });
  }
  if (filters.channel !== 'all') chips.push({ id: 'channel', label: filters.channel });
  if (filters.contentType !== 'all') {
    chips.push({
      id: 'contentType',
      label: labels.contentType?.(filters.contentType) ?? filters.contentType,
    });
  }
  if (filters.status !== 'all') chips.push({ id: 'status', label: labels.status(filters.status) });
  if (filters.review !== 'all') chips.push({ id: 'review', label: labels.review(filters.review) });
  if (filters.approval !== 'all') {
    chips.push({
      id: 'approval',
      label: labels.approval?.(filters.approval) ?? filters.approval,
    });
  }
  if (filters.assignee !== 'all') chips.push({ id: 'assignee', label: filters.assignee });
  if (filters.dateFrom) chips.push({ id: 'dateFrom', label: filters.dateFrom });
  if (filters.dateTo) chips.push({ id: 'dateTo', label: filters.dateTo });
  return chips;
}

export function clearContentChip(filters: ContentFilters, id: string): ContentFilters {
  if (id === 'query') return { ...filters, query: '' };
  if (id === 'campaignId') return { ...filters, campaignId: 'all' };
  if (id.startsWith('brand:')) {
    const brandId = id.slice('brand:'.length);
    return { ...filters, brandIds: filters.brandIds.filter((b) => b !== brandId) };
  }
  if (id === 'brandId' || id === 'brandIds') return { ...filters, brandIds: [] };
  if (id === 'channel') return { ...filters, channel: 'all' };
  if (id === 'contentType') return { ...filters, contentType: 'all' };
  if (id === 'status') return { ...filters, status: 'all' };
  if (id === 'review') return { ...filters, review: 'all' };
  if (id === 'approval') return { ...filters, approval: 'all' };
  if (id === 'assignee') return { ...filters, assignee: 'all' };
  if (id === 'dateFrom') return { ...filters, dateFrom: '' };
  if (id === 'dateTo') return { ...filters, dateTo: '' };
  return filters;
}

export function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export function groupContentByDay(items: ContentRow[]): Map<string, ContentRow[]> {
  const map = new Map<string, ContentRow[]>();
  for (const item of items) {
    const key = dayKey(resolveContentWorkflow(item).plannedAt);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
  }
  return map;
}

export function splitCellItems(
  items: ContentRow[],
  max = MAX_CELL_ITEMS,
): { visible: ContentRow[]; extra: number } {
  return {
    visible: items.slice(0, max),
    extra: Math.max(0, items.length - max),
  };
}

/**
 * Build month grid cells.
 * weekStartsOn: 0=Sunday, 1=Monday (Planable EN LIVE_VERIFIED), 6=Saturday (AR).
 */
export function buildMonthCells(
  year: number,
  monthIndex: number,
  weekStartsOn: 0 | 1 | 6 = 1,
): Array<{ date: Date; inMonth: boolean; key: string }> {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startDow = first.getUTCDay();
  const offset = (startDow - weekStartsOn + 7) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - offset));
  const cells: Array<{ date: Date; inMonth: boolean; key: string }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getTime() + i * 86400000);
    const key = d.toISOString().slice(0, 10);
    cells.push({
      date: d,
      inMonth: d.getUTCMonth() === monthIndex,
      key,
    });
  }
  return cells;
}

export function monthLabel(year: number, monthIndex: number, locale: string): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  // Planable LIVE_VERIFIED calendar chrome uses short month ("Oct 2026").
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function channelMarker(channel: string): string {
  const c = channel.toLowerCase();
  if (c.includes('instagram')) return 'IG';
  if (c.includes('linkedin')) return 'LI';
  if (c.includes('tiktok')) return 'TT';
  if (c.includes('meta')) return 'MA';
  if (c.includes('email')) return 'EM';
  return channel.slice(0, 2).toUpperCase();
}

export function statusLabel(status: string, locale: string): string {
  const ar = locale.toLowerCase().startsWith('ar');
  const map: Record<string, { en: string; ar: string }> = {
    DRAFT: { en: 'Draft', ar: 'مسودة' },
    IN_REVIEW: { en: 'Needs review', ar: 'يحتاج مراجعة' },
    APPROVED: { en: 'Approved', ar: 'معتمد' },
    SCHEDULED: { en: 'Scheduled', ar: 'مجدول' },
    PUBLISHED_DEMO: { en: 'Published (demo)', ar: 'منشور (تجريبي)' },
    CLEAR: { en: 'Clear', ar: 'واضح' },
    NEEDS_ATTENTION: { en: 'Needs attention', ar: 'يحتاج انتباهًا' },
    ACTIVE: { en: 'Active', ar: 'نشط' },
    UPCOMING: { en: 'Upcoming', ar: 'قادم' },
    COMPLETED: { en: 'Completed', ar: 'مكتمل' },
    ARCHIVED: { en: 'Archived', ar: 'مؤرشف' },
    IN_REVIEW_CAMPAIGN: { en: 'In review', ar: 'قيد المراجعة' },
  };
  const row = map[status];
  if (!row) return status;
  return ar ? row.ar : row.en;
}

export type ContentSortKey =
  'title' | 'channel' | 'campaign' | 'owner' | 'status' | 'review' | 'date' | 'updated';

export function sortContent(
  items: ContentRow[],
  key: ContentSortKey,
  dir: 'asc' | 'desc',
  locale: string,
  campaignName: (id: string) => string,
): ContentRow[] {
  const ar = locale.toLowerCase().startsWith('ar');
  const mul = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    let av = '';
    let bv = '';
    if (key === 'title') {
      av = ar ? a.title.ar : a.title.en;
      bv = ar ? b.title.ar : b.title.en;
    } else if (key === 'channel') {
      av = a.channel;
      bv = b.channel;
    } else if (key === 'campaign') {
      av = campaignName(a.campaignId);
      bv = campaignName(b.campaignId);
    } else if (key === 'owner') {
      av = a.assignee;
      bv = b.assignee;
    } else if (key === 'status' || key === 'review') {
      av = a.status;
      bv = b.status;
    } else if (key === 'date' || key === 'updated') {
      av = a.scheduledAt ?? '';
      bv = b.scheduledAt ?? '';
    }
    return av.localeCompare(bv) * mul;
  });
}

export type ContentComment = {
  id: string;
  author: string;
  body: { en: string; ar: string };
  at: string;
  resolved?: boolean;
  replies?: Array<{ id: string; author: string; body: { en: string; ar: string }; at: string }>;
};

export function commentsForContent(
  tasks: TaskRow[],
  deliverables: DeliverableRow[],
  contentId: string,
): ContentComment[] {
  const fromTasks: ContentComment[] = tasks
    .filter((task) => task.contentId === contentId)
    .flatMap((task) =>
      task.comments.map((c) => ({
        id: c.id,
        author: c.author,
        body: c.body,
        at: c.at,
        resolved: false,
      })),
    );
  const fromDeliverables: ContentComment[] = deliverables
    .filter((d) => d.contentId === contentId)
    .flatMap((d) =>
      d.comments.map((c) => ({
        id: c.id,
        author: c.author,
        body: c.body,
        at: c.at,
        resolved: c.resolved,
      })),
    );
  return [...fromDeliverables, ...fromTasks].sort((a, b) => a.at.localeCompare(b.at));
}

export function reviewPresentation(
  status: string,
  locale: string,
): {
  label: string;
  state: 'draft' | 'review' | 'approved' | 'changes' | 'scheduled' | 'published';
  disabledReason: string | null;
} {
  const ar = locale.toLowerCase().startsWith('ar');
  if (status === 'IN_REVIEW') {
    return {
      label: statusLabel(status, locale),
      state: 'review',
      disabledReason: ar
        ? 'الموافقة المباشرة غير متصلة — هذا عرض تخطيطي.'
        : 'Live approval is not connected — planning presentation only.',
    };
  }
  if (status === 'APPROVED') {
    return { label: statusLabel(status, locale), state: 'approved', disabledReason: null };
  }
  if (status === 'SCHEDULED') {
    return { label: statusLabel(status, locale), state: 'scheduled', disabledReason: null };
  }
  if (status === 'PUBLISHED_DEMO') {
    return { label: statusLabel(status, locale), state: 'published', disabledReason: null };
  }
  return { label: statusLabel(status, locale), state: 'draft', disabledReason: null };
}

export function linkedIdsForContent(
  tasks: TaskRow[],
  deliverables: DeliverableRow[],
  requests: DemoGraph['requests'],
  contentId: string,
): { taskId: string | null; deliverableId: string | null; requestId: string | null } {
  const task = tasks.find((t) => t.contentId === contentId);
  const deliverable = deliverables.find((d) => d.contentId === contentId);
  const request = requests.find((r) => r.contentId === contentId);
  return {
    taskId: task?.id ?? null,
    deliverableId: deliverable?.id ?? null,
    requestId: request?.id ?? null,
  };
}


/** Human label for system enums (content type, request type, etc.). Never returns a ULID. */
export function contentTypeLabel(value: string, locale: string): string {
  return statusLabel(value, locale);
}

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

export function isRawId(value: string | null | undefined): boolean {
  if (!value) return false;
  return ULID_RE.test(value.trim()) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value.trim());
}

/** Prefer a display name; never surface a raw database id to the user. */
export function humanRef(value: string | null | undefined, fallback = '—'): string {
  if (!value || !value.trim()) return fallback;
  if (isRawId(value)) return fallback;
  return value;
}
