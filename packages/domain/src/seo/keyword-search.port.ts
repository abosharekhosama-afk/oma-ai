import type { KeywordMetric, KeywordResearchRequest, StrategyResearchPort } from '../strategy/research-port';

export type KeywordSearchProvider = 'manual' | 'external_fixture' | 'external_live';

export interface ExternalKeywordSearchPort {
  readonly provider: KeywordSearchProvider;
  readonly measured: boolean;
  lookup(request: KeywordResearchRequest): Promise<KeywordMetric[]>;
}

/** Fixture “measured” metrics for integration tests (not live Semrush/DataForSEO). */
export const externalFixtureKeywordSearch: ExternalKeywordSearchPort = {
  provider: 'external_fixture',
  measured: true,
  async lookup(request) {
    return request.keywords.map((k, i) => ({
      keyword: k.keyword,
      locale: k.locale,
      monthly_volume: 400 + i * 120,
      difficulty: 35 + (i % 5) * 8,
      intent: i % 2 === 0 ? 'COMMERCIAL' : 'INFORMATIONAL',
      source: 'EXTERNAL',
    }));
  },
};

export function asStrategyResearchPort(adapter: ExternalKeywordSearchPort): StrategyResearchPort {
  return {
    id: 'external',
    measured: adapter.measured,
    async keywordMetrics(request) {
      const rows = await adapter.lookup(request);
      return rows.map((r) => ({
        ...r,
        source: 'EXTERNAL' as const,
      }));
    },
  };
}