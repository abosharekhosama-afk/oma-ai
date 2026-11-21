import type { SearchAnalyticsRequest, SearchAnalyticsRow, SearchConsolePort } from './search-console.port';

/** Deterministic sample rows for dev/CI (labelled GSC_FIXTURE). */
export const fixtureSearchConsolePort: SearchConsolePort = {
  source: 'GSC_FIXTURE',
  configured: true,
  async listVerifiedSites() {
    return ['https://example-brand.test/', 'sc-domain:example-brand.test'];
  },
  async querySearchAnalytics(request: SearchAnalyticsRequest): Promise<SearchAnalyticsRow[]> {
    const host = (() => {
      try {
        return new URL(request.siteUrl.replace(/^sc-domain:/, 'https://')).host;
      } catch {
        return 'example-brand.test';
      }
    })();
    return [
      {
        query: 'عناية بالبشرة',
        page: `https://${host}/products/serum`,
        clicks: 42,
        impressions: 1200,
        ctr: 0.035,
        position: 8.4,
      },
      {
        query: 'brand name',
        page: `https://${host}/`,
        clicks: 88,
        impressions: 2400,
        ctr: 0.037,
        position: 4.1,
      },
      {
        query: 'organic skincare',
        page: `https://${host}/collections/face`,
        clicks: 15,
        impressions: 890,
        ctr: 0.017,
        position: 14.2,
      },
    ].slice(0, request.rowLimit ?? 25);
  },
};