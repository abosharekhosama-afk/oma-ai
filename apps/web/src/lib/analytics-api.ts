import { api } from './api';

export type StatusCounts = Record<
  'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED_SAMPLE',
  number
>;
export type ApprovalStats = {
  submitted: number;
  approved: number;
  rejected: number;
  changes_requested: number;
  avg_hours_to_approval: number | null;
  avg_revision_rounds: number | null;
  rejection_rate: number | null;
};
export type WorkAnalytics = {
  range: { from: string; to: string; days: number; bucket: 'day' | 'week' };
  filters: {
    brand_id: string | null;
    campaign_id: string | null;
    brands: Array<{ id: string; name: string }>;
    campaigns: Array<{ id: string; brand_id: string; name: { en: string; ar: string } }>;
  };
  content: {
    total: number;
    by_status: StatusCounts;
    per_brand: Array<{ id: string; name: string; total: number; by_status: StatusCounts }>;
    per_campaign: Array<{
      id: string;
      name: { en: string; ar: string };
      total: number;
      by_status: StatusCounts;
    }>;
    series: Array<{ bucket: string; scheduled: number; published: number; created: number }>;
  };
  approvals: { content: ApprovalStats; deliverables: ApprovalStats };
  on_time: {
    overdue_posts: number;
    overdue_tasks: number;
    tasks_completed_with_due: number;
    tasks_on_time: number;
    task_on_time_rate: number | null;
    posts_due: number;
    posts_approved_on_time: number;
    post_on_time_rate: number | null;
  };
  team: Array<{
    user_id: string;
    name: string;
    tasks_completed: number;
    deliverables_approved: number;
    posts_created: number;
    approvals_given: number;
  }>;
  social: { connected: boolean };
  generated_at: string;
};

export type AnalyticsPeriod = '7' | '30' | '90' | 'custom';
export type AnalyticsParams = {
  period: AnalyticsPeriod;
  from?: string;
  to?: string;
  brandId?: string | null;
  campaignId?: string | null;
};

export function analyticsQuery(p: AnalyticsParams): string {
  const qs = new URLSearchParams();
  if (p.period === 'custom' && p.from && p.to) {
    qs.set('from', p.from);
    qs.set('to', p.to);
  } else {
    qs.set('period', p.period === 'custom' ? '30' : p.period);
  }
  if (p.brandId) qs.set('brandId', p.brandId);
  if (p.campaignId) qs.set('campaignId', p.campaignId);
  return qs.toString();
}

export async function getWorkAnalytics(p: AnalyticsParams): Promise<WorkAnalytics> {
  return (await api<{ data: WorkAnalytics }>(`/api/v1/analytics?${analyticsQuery(p)}`)).data;
}

/** "3.5h" / "2.1d" for approval durations. */
export function formatHours(h: number | null, locale: string): string {
  if (h === null) return '—';
  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', { maximumFractionDigits: 1 });
  return h < 48
    ? `${nf.format(h)}${locale === 'ar' ? ' س' : 'h'}`
    : `${nf.format(h / 24)}${locale === 'ar' ? ' ي' : 'd'}`;
}

export function formatRate(r: number | null, locale: string): string {
  if (r === null) return '—';
  return `${new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', { maximumFractionDigits: 1 }).format(r)}%`;
}

/** Max value for a chart axis (never 0, rounded up to a friendly step). */
export function niceMax(values: number[]): number {
  const m = Math.max(0, ...values);
  if (m <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(m));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * pow >= m) return step * pow;
  return 10 * pow;
}

/* ── Planable-style overview (GET /api/v1/analytics/content) ───────────── */

export const OVERVIEW_METRICS = [
  'posts',
  'published',
  'scheduled',
  'approvals',
  'comments',
] as const;
export type OverviewMetric = (typeof OVERVIEW_METRICS)[number];
export type MetricCounts = Record<OverviewMetric, number>;
export type OverviewRow = {
  id: string;
  brand_id: string;
  brand_name: string;
  channel: string;
  content_type: string;
  status: string;
  title: { en: string; ar: string };
  caption: { en: string; ar: string };
  preview_asset_url: string | null;
  date: string;
  comments: number;
  approvals: number;
  changes_requested: number;
  published: boolean;
};
export type ContentOverview = {
  range: { from: string; to: string; days: number };
  previous: { from: string; to: string };
  granularity: 'day' | 'week';
  kpis: Record<OverviewMetric, { value: number; previous: number; delta: number | null }>;
  approval_rate: number | null;
  series: Array<{ bucket: string; total: MetricCounts; by_channel: Record<string, MetricCounts> }>;
  channels: Array<{
    channel: string;
    current: MetricCounts;
    previous: MetricCounts;
    delta: Record<OverviewMetric, number | null>;
  }>;
  top_content: { comments: OverviewRow[]; approvals: OverviewRow[] };
  content: {
    rows: OverviewRow[];
    total_rows: number;
    totals: { comments: number; approvals: number; changes_requested: number };
  };
  social: { connected: boolean; unavailable: string[] };
  filters: {
    brand_id: string | null;
    channels: string[];
    brands: Array<{ id: string; name: string }>;
    available_channels: Array<{ channel: string; posts: number }>;
  };
  generated_at: string;
};

export type OverviewParams = AnalyticsParams & {
  channels?: string[] | null;
  granularity?: 'day' | 'week' | null;
};

export function overviewQuery(p: OverviewParams): string {
  const qs = new URLSearchParams(analyticsQuery({ ...p, campaignId: null }));
  if (p.channels && p.channels.length) qs.set('channels', [...p.channels].sort().join(','));
  if (p.granularity) qs.set('granularity', p.granularity);
  return qs.toString();
}

export async function getContentOverview(p: OverviewParams): Promise<ContentOverview> {
  return (await api<{ data: ContentOverview }>(`/api/v1/analytics/content?${overviewQuery(p)}`))
    .data;
}

export function numberFormat(locale: string, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', opts);
}

/** Signed delta label: "↑ 12%", "↓ 4%", "→ 0%"; null delta (no baseline) → "new" handled by caller. */
export function deltaTone(d: number | null): 'up' | 'down' | 'flat' | 'none' {
  if (d === null) return 'none';
  return d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
}

/** Planable content-table filter groups. */
export type ContentFilter = 'all' | 'posts' | 'videos' | 'stories';
export function matchesContentFilter(contentType: string, f: ContentFilter): boolean {
  if (f === 'all') return true;
  if (f === 'videos') return contentType === 'REEL';
  if (f === 'stories') return contentType === 'STORY';
  return contentType !== 'REEL' && contentType !== 'STORY';
}

/** SVG path points for a series scaled into a w×h box (x mirrored for RTL). */
export function chartPoints(
  values: number[],
  w: number,
  h: number,
  max: number,
  rtl = false,
): Array<[number, number]> {
  const n = values.length;
  return values.map((v, i) => {
    const x = n <= 1 ? w / 2 : (i / (n - 1)) * w;
    const y = h - (max > 0 ? (v / max) * h : 0);
    return [Math.round((rtl ? w - x : x) * 10) / 10, Math.round(y * 10) / 10];
  });
}

/** RFC 4180 CSV (quotes fields with comma/quote/newline); BOM keeps Arabic readable in Excel. */
export function toCsv(rows: Array<Array<string | number>>): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
