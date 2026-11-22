import type {
  KeywordMetric,
  KeywordResearchRequest,
  StrategyResearchPort,
} from '../strategy/research-port';

export type KeywordSearchProvider = 'manual' | 'external_fixture' | 'external_live';

export interface ExternalKeywordSearchPort {
  readonly provider: KeywordSearchProvider;
  readonly measured: boolean;
  lookup(request: KeywordResearchRequest): Promise<KeywordMetric[]>;
}

/**
 * Sample metrics for dev/CI only (not live Semrush/DataForSEO). Labelled FIXTURE and
 * `measured: false` so they are never shown as real market data (DEC-029 4.0).
 */
export const externalFixtureKeywordSearch: ExternalKeywordSearchPort = {
  provider: 'external_fixture',
  measured: false,
  async lookup(request) {
    return request.keywords.map((k, i) => ({
      keyword: k.keyword,
      locale: k.locale,
      monthly_volume: 400 + i * 120,
      difficulty: 35 + (i % 5) * 8,
      intent: i % 2 === 0 ? 'COMMERCIAL' : 'INFORMATIONAL',
      source: 'FIXTURE',
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
        // Only a measured (live) provider may label metrics EXTERNAL.
        source: adapter.measured ? ('EXTERNAL' as const) : ('FIXTURE' as const),
      }));
    },
  };
}
