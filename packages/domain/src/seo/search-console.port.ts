export type SearchConsoleMetricSource = 'GSC_LIVE' | 'GSC_FIXTURE' | 'NOT_CONFIGURED';

export type SearchAnalyticsRow = {
  query: string;
  page?: string | null;
  country?: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchAnalyticsRequest = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  rowLimit?: number;
};

export interface SearchConsolePort {
  readonly source: SearchConsoleMetricSource;
  readonly configured: boolean;
  querySearchAnalytics(request: SearchAnalyticsRequest): Promise<SearchAnalyticsRow[]>;
  listVerifiedSites(): Promise<string[]>;
}

export const refusingSearchConsolePort: SearchConsolePort = {
  source: 'NOT_CONFIGURED',
  configured: false,
  async querySearchAnalytics() {
    return [];
  },
  async listVerifiedSites() {
    return [];
  },
};