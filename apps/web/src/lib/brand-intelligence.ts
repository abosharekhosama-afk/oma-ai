import type { InsightItem } from './brand-types';

/** Shape of GET /api/v1/ai/status that the brand hubs read. */
export type AiStatusSummary = {
  provider?: string;
  live_enabled?: boolean;
  availability?: 'AVAILABLE' | 'NOT_CONFIGURED' | 'BUDGET_EXHAUSTED';
  default_model?: string;
  reasoning_model?: string;
  strategy_ai_mode?: 'live' | 'refuse' | 'not_configured' | string;
};

/** Human review progress over a profile's insights (accepted/edited/rejected count as reviewed). */
export function insightReviewProgress(insights: Pick<InsightItem, 'review_status'>[]) {
  const total = insights.length;
  const pending = insights.filter((i) => i.review_status === 'PENDING').length;
  const reviewed = total - pending;
  return {
    total,
    pending,
    reviewed,
    percent: total === 0 ? 0 : Math.round((reviewed / total) * 100),
  };
}
