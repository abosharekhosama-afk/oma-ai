import { api } from './api';

export type OptimalSlot = {
  day_of_week: number;
  minute_of_day: number;
  rank: number;
  score: number;
  confidence: number;
  label: 'high' | 'medium' | 'low';
  time_label: string;
};

export type OptimalTimesStatus = 'ready' | 'low_data' | 'no_data';

export type OptimalTimesList = {
  timezone: string;
  status: OptimalTimesStatus;
  sample_size: number;
  social_page_id: string | null;
  network: string | null;
  slots: OptimalSlot[];
  pages: Array<{
    social_page_id: string;
    name: string;
    network: string;
    status: OptimalTimesStatus;
    sample_size: number;
    slots: OptimalSlot[];
    generated_at: string;
  }>;
  generated_at: string;
};

export type OptimalHeatmap = {
  timezone: string;
  status: OptimalTimesStatus;
  sample_size: number;
  metric: 'rate' | 'engagements';
  social_page_id: string | null;
  network: string | null;
  cells: Array<Array<{ score: number; n: number; confidence: number }>>;
  pages: Array<{ id: string; name: string; network: string }>;
  generated_at: string;
};

export type OptimalSuggest = {
  timezone: string;
  date: string;
  day_of_week: number;
  status: OptimalTimesStatus;
  conflict: boolean;
  slots: OptimalSlot[];
  pages: Array<{
    social_page_id: string;
    name: string;
    network: string;
    status: OptimalTimesStatus;
    sample_size: number;
    slots: OptimalSlot[];
  }>;
};

function qs(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) search.set(k, v);
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}

export function getOptimalTimes(p: {
  brandId?: string | null;
  socialPageId?: string | null;
  network?: string | null;
}) {
  return api<OptimalTimesList>(
    `/api/v1/analytics/optimal-times${qs({
      brandId: p.brandId ?? undefined,
      socialPageId: p.socialPageId ?? undefined,
      network: p.network ?? undefined,
    })}`,
  );
}

export function getOptimalTimesHeatmap(p: {
  brandId?: string | null;
  socialPageId?: string | null;
  network?: string | null;
  metric?: 'rate' | 'engagements';
}) {
  return api<OptimalHeatmap>(
    `/api/v1/analytics/optimal-times/heatmap${qs({
      brandId: p.brandId ?? undefined,
      socialPageId: p.socialPageId ?? undefined,
      network: p.network ?? undefined,
      metric: p.metric,
    })}`,
  );
}

export function getOptimalTimeSuggestions(p: {
  brandId?: string | null;
  socialPageIds?: string[];
  date?: string | null;
}) {
  return api<OptimalSuggest>(
    `/api/v1/analytics/optimal-times/suggest${qs({
      brandId: p.brandId ?? undefined,
      socialPageIds: p.socialPageIds?.length ? p.socialPageIds.join(',') : undefined,
      date: p.date ?? undefined,
    })}`,
  );
}
