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
