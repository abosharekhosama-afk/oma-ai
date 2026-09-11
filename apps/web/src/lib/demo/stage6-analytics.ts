import type { DemoGraph, DemoTrack } from '@oma/demo';

export type AnalyticsData = DemoGraph['analytics'];

export type AnalyticsFilters = {
  track: 'all' | DemoTrack;
  channel: string;
  campaignId: string;
  contentType: string;
};

export const EMPTY_ANALYTICS_FILTERS: AnalyticsFilters = {
  track: 'all',
  channel: 'all',
  campaignId: 'all',
  contentType: 'all',
};

export function safeDivide(n: number, d: number): number {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return n / d;
}

export function round1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export function percentDelta(current: number, previous: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) return current === 0 ? 0 : 100;
  return round1(((current - previous) / Math.abs(previous)) * 100);
}

/** Semantic direction: positive means “good” for the KPI. */
export function kpiDeltaTone(
  delta: number,
  higherIsBetter: boolean,
): 'positive' | 'negative' | 'neutral' {
  if (Math.abs(delta) < 0.05) return 'neutral';
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? 'positive' : 'negative';
}

export function filterSeries(data: AnalyticsData, filters: AnalyticsFilters) {
  return data.series.filter((p) => {
    if (filters.track !== 'all' && p.track !== filters.track) return false;
    return true;
  });
}

export function filterChannels(data: AnalyticsData, filters: AnalyticsFilters) {
  return data.channels.filter((c) => {
    if (filters.track !== 'all' && c.track !== filters.track) return false;
    if (filters.channel !== 'all' && c.channel !== filters.channel) return false;
    return true;
  });
}

export function filterCampaignRows(data: AnalyticsData, filters: AnalyticsFilters) {
  return data.campaigns.filter((c) => {
    if (filters.track !== 'all' && c.track !== filters.track) return false;
    if (filters.campaignId !== 'all' && c.campaignId !== filters.campaignId) return false;
    return true;
  });
}

export function filterContentPerf(data: AnalyticsData, filters: AnalyticsFilters) {
  return data.contentPerformance.filter((c) => {
    if (filters.track !== 'all' && c.track !== filters.track) return false;
    if (filters.channel !== 'all' && c.channel !== filters.channel) return false;
    if (filters.campaignId !== 'all' && c.campaignId !== filters.campaignId) return false;
    return true;
  });
}

export function seriesTotals(points: AnalyticsData['series']) {
  return points.reduce(
    (acc, p) => {
      acc.impressions += p.impressions;
      acc.engagement += p.engagement;
      acc.clicks += p.clicks;
      return acc;
    },
    { impressions: 0, engagement: 0, clicks: 0 },
  );
}

export function organicPaidComparison(data: AnalyticsData) {
  const organic = data.series.filter((p) => p.track === 'ORGANIC');
  const paid = data.series.filter((p) => p.track === 'PAID');
  return {
    organic: seriesTotals(organic),
    paid: seriesTotals(paid),
  };
}

/** Build SVG polyline points for a numeric series (normalized 0..100 height). */
export function sparklinePoints(
  values: number[],
  width = 320,
  height = 80,
  pad = 4,
): { points: string; max: number } {
  const max = Math.max(1, ...values.filter((v) => Number.isFinite(v)));
  if (values.length === 0) return { points: '', max };
  const step = values.length === 1 ? 0 : (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = height - pad - (Math.max(0, v) / max) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { points: pts.join(' '), max };
}
