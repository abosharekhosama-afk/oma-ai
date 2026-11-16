import type { StrategyDataSource, StrategySearchIntent } from './tracks-v2';

/**
 * Pluggable research source for SEO keyword metrics (DEC-021).
 *
 * Phase 1 ships two adapters: `manual` (never invents metrics) and
 * `ai_estimate` (wraps a model estimate, labelled AI_ESTIMATE). A live provider
 * (Semrush, DataForSEO, …) is a later adapter and needs its own decision.
 */
export type KeywordResearchRequest = {
  keywords: Array<{ keyword: string; locale: string }>;
  market?: string | null;
};

export type KeywordMetric = {
  keyword: string;
  locale: string;
  monthly_volume: number | null;
  difficulty: number | null;
  intent: StrategySearchIntent | null;
  source: StrategyDataSource;
};

export interface StrategyResearchPort {
  readonly id: 'manual' | 'ai_estimate' | 'external';
  /** True when metrics come from measured data rather than input or estimates. */
  readonly measured: boolean;
  keywordMetrics(request: KeywordResearchRequest): Promise<KeywordMetric[]>;
}

/** Default adapter: returns no metrics, so nothing is presented as measured. */
export const manualResearchAdapter: StrategyResearchPort = {
  id: 'manual',
  measured: false,
  async keywordMetrics(request) {
    return request.keywords.map((k) => ({
      keyword: k.keyword,
      locale: k.locale,
      monthly_volume: null,
      difficulty: null,
      intent: null,
      source: 'MANUAL',
    }));
  },
};

/** Wrap estimates (e.g. from a model) and force the AI_ESTIMATE label. */
export function aiEstimateResearchAdapter(
  estimate: (request: KeywordResearchRequest) => Promise<Omit<KeywordMetric, 'source'>[]>,
): StrategyResearchPort {
  return {
    id: 'ai_estimate',
    measured: false,
    async keywordMetrics(request) {
      const rows = await estimate(request);
      return rows.map((r) => ({
        ...r,
        monthly_volume: r.monthly_volume == null ? null : Math.max(0, Math.round(r.monthly_volume)),
        difficulty:
          r.difficulty == null ? null : Math.min(100, Math.max(0, Math.round(r.difficulty))),
        source: 'AI_ESTIMATE',
      }));
    },
  };
}

export type StrategyResearchMode = 'manual' | 'ai_estimate';

export function strategyResearchModeFromEnv(raw: string | undefined): StrategyResearchMode {
  return (raw ?? '').trim().toLowerCase() === 'ai_estimate' ? 'ai_estimate' : 'manual';
}
