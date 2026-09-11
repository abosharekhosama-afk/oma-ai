import type { DemoGraph } from '@oma/demo';

export type ContentRow = DemoGraph['contentItems'][number];

export type ContentFilters = {
  query: string;
  campaignId: string;
  channel: string;
  contentType: string;
  status: string;
  review: string;
  assignee: string;
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_CONTENT_FILTERS: ContentFilters = {
  query: '',
  campaignId: 'all',
  channel: 'all',
  contentType: 'all',
  status: 'all',
  review: 'all',
  assignee: 'all',
  dateFrom: '',
  dateTo: '',
};

export type ContentViewMode = 'calendar' | 'list' | 'grid';

export function filterContent(
  items: ContentRow[],
  filters: ContentFilters,
  locale: string,
): ContentRow[] {
  const q = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.campaignId !== 'all' && item.campaignId !== filters.campaignId) return false;
    if (filters.channel !== 'all' && item.channel !== filters.channel) return false;
    if (filters.contentType !== 'all' && item.contentType !== filters.contentType) return false;
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.assignee !== 'all' && item.assignee !== filters.assignee) return false;
    if (filters.review === 'needs' && item.status !== 'IN_REVIEW') return false;
    if (filters.review === 'approved' && item.status !== 'APPROVED') return false;
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
  if (filters.channel !== 'all') n += 1;
  if (filters.contentType !== 'all') n += 1;
  if (filters.status !== 'all') n += 1;
  if (filters.review !== 'all') n += 1;
  if (filters.assignee !== 'all') n += 1;
  if (filters.dateFrom) n += 1;
  if (filters.dateTo) n += 1;
  return n;
}

export function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export function groupContentByDay(items: ContentRow[]): Map<string, ContentRow[]> {
  const map = new Map<string, ContentRow[]>();
  for (const item of items) {
    const key = dayKey(item.scheduledAt);
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

/** Build month grid cells (Sun–Sat or Sat–Fri for AR can be handled by caller via weekStartsOn). */
export function buildMonthCells(
  year: number,
  monthIndex: number,
  weekStartsOn: 0 | 6 = 0,
): Array<{ date: Date; inMonth: boolean; key: string }> {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startDow = first.getUTCDay();
  const offset = weekStartsOn === 6 ? (startDow + 1) % 7 : startDow; /* Sat start: shift so Sat=0 */
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
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    month: 'long',
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
