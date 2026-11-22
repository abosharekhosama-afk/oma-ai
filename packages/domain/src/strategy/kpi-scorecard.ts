/**
 * DEC-029 4.5: strategy KPIs bound to metrics OMA can measure. Anything else is a
 * manual KPI whose actual value a person records (labelled as manual, never guessed).
 */
export const STRATEGY_KPI_METRICS = [
  'posts_published',
  'publish_rate',
  'impressions',
  'reach',
  'engagements',
  'engagement_rate',
  'video_views',
] as const;
export type StrategyKpiMetric = (typeof STRATEGY_KPI_METRICS)[number];

export const STRATEGY_KPI_PERIODS = ['WEEK', 'MONTH', 'QUARTER', 'VERSION'] as const;
export type StrategyKpiPeriod = (typeof STRATEGY_KPI_PERIODS)[number];

export const STRATEGY_KPI_SCOPES = ['STRATEGY_CONTENT', 'BRAND'] as const;
export type StrategyKpiScope = (typeof STRATEGY_KPI_SCOPES)[number];

export const KPI_METRIC_UNITS: Record<StrategyKpiMetric, 'count' | 'percent'> = {
  posts_published: 'count',
  publish_rate: 'percent',
  impressions: 'count',
  reach: 'count',
  engagements: 'count',
  engagement_rate: 'percent',
  video_views: 'count',
};

export function isMeasurableKpiMetric(value: unknown): value is StrategyKpiMetric {
  return typeof value === 'string' && (STRATEGY_KPI_METRICS as readonly string[]).includes(value);
}

const DAY = 86_400_000;

/** Rolling window ending now; VERSION runs from approval (or 90 days back when unknown). */
export function kpiWindow(
  period: string,
  now: Date,
  approvedAt?: Date | null,
): { from: Date; to: Date; days: number } {
  const days = period === 'WEEK' ? 7 : period === 'QUARTER' ? 90 : period === 'VERSION' ? 0 : 30;
  if (days === 0) {
    const from = approvedAt ?? new Date(now.getTime() - 90 * DAY);
    return { from, to: now, days: Math.max(1, Math.ceil((now.getTime() - from.getTime()) / DAY)) };
  }
  return { from: new Date(now.getTime() - days * DAY), to: now, days };
}

export type KpiPostSample = { plannedAt: Date | null; publishedAt: Date | null };
export type KpiMetricSample = {
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
  engagementRate: number | null;
};

const sum = (rows: KpiMetricSample[], pick: (r: KpiMetricSample) => number | null) =>
  rows.reduce((total, r) => total + (pick(r) ?? 0), 0);

/**
 * Actual value of a measurable metric in a window. Returns null when there is no
 * data to measure (no published posts / no metric snapshots), never zero-by-default.
 */
export function measureKpi(
  metric: StrategyKpiMetric,
  window: { from: Date; to: Date },
  posts: KpiPostSample[],
  metrics: KpiMetricSample[],
): number | null {
  const inWindow = (d: Date | null) => !!d && d >= window.from && d <= window.to;
  switch (metric) {
    case 'posts_published':
      return posts.filter((p) => inWindow(p.publishedAt)).length;
    case 'publish_rate': {
      const due = posts.filter((p) => inWindow(p.plannedAt));
      if (!due.length) return null;
      return Math.round((due.filter((p) => p.publishedAt).length / due.length) * 1000) / 10;
    }
    default: {
      if (!metrics.length) return null;
      if (metric === 'impressions') return sum(metrics, (r) => r.impressions);
      if (metric === 'reach') return sum(metrics, (r) => r.reach);
      if (metric === 'video_views') return sum(metrics, (r) => r.views);
      if (metric === 'engagements')
        return sum(metrics, (r) => (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0));
      const rated = metrics.filter((r) => r.engagementRate != null);
      if (!rated.length) return null;
      const avg = rated.reduce((t, r) => t + (r.engagementRate ?? 0), 0) / rated.length;
      // Stored as a ratio (0.042) or a percent (4.2) depending on the source.
      return Math.round((avg <= 1 ? avg * 100 : avg) * 100) / 100;
    }
  }
}

export type KpiStatus =
  'on_track' | 'at_risk' | 'behind' | 'no_data' | 'no_target' | 'not_recorded';

export function kpiProgress(
  actual: number | null,
  target: number | null,
  opts: { manual?: boolean } = {},
): { progress_pct: number | null; status: KpiStatus } {
  if (actual == null)
    return { progress_pct: null, status: opts.manual ? 'not_recorded' : 'no_data' };
  if (target == null || target <= 0) return { progress_pct: null, status: 'no_target' };
  const pct = Math.round((actual / target) * 100);
  return { progress_pct: pct, status: pct >= 100 ? 'on_track' : pct >= 70 ? 'at_risk' : 'behind' };
}

/** Parse a legacy free-text target ("1,200", "4.5%") into a number. */
export function parseKpiTarget(raw: string | null | undefined): number | null {
  const m = (raw ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}
