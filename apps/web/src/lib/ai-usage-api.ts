import { api } from './api';

export type AiUsageBucket = {
  use_case: string;
  runs: number;
  succeeded: number;
  failed: number;
  schema_invalid: number;
  refused: number;
  repaired: number;
  human_rejected: number;
  legacy_v1: number;
  cost_usd: number;
};

export type AiUsageSummary = {
  month: string;
  totals: AiUsageBucket;
  by_use_case: AiUsageBucket[];
  budget?: { monthly_budget?: number | string | null; spent?: number | string | null } & Record<
    string,
    unknown
  >;
};

export type AiRunListItem = {
  id: string;
  use_case: string;
  status: string;
  provider: string;
  model: string;
  contract_id: string | null;
  schema_version: string;
  legacy: boolean;
  attempt_count: number;
  failure_stage: string | null;
  error_code: string | null;
  refusal_reason: string | null;
  review: 'ACCEPTED' | 'REJECTED' | null;
  cost_usd: number;
  latency_ms: number | null;
  created_at: string;
};

export const aiUsageApi = {
  usage: (month?: string) =>
    api<{ data: AiUsageSummary }>(
      `/api/v1/ai/usage${month ? `?month=${encodeURIComponent(month)}` : ''}`,
    ),
  runs: (query: { cursor?: string | null; limit?: number; status?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.limit) params.set('limit', String(query.limit));
    if (query.status) params.set('status', query.status);
    const qs = params.toString();
    return api<{ data: { items: AiRunListItem[]; next_cursor: string | null } }>(
      `/api/v1/ai/runs${qs ? `?${qs}` : ''}`,
    );
  },
};

/** Share of runs that needed a repair attempt or failed, as whole percents. */
export function aiUsageRates(bucket: Pick<AiUsageBucket, 'runs' | 'repaired' | 'failed'>) {
  if (!bucket.runs) return { repairPct: 0, failurePct: 0 };
  return {
    repairPct: Math.round((bucket.repaired / bucket.runs) * 100),
    failurePct: Math.round((bucket.failed / bucket.runs) * 100),
  };
}

export function formatUsd(value: number, locale: string): string {
  return new Intl.NumberFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}
