import type { SearchAnalyticsRequest, SearchAnalyticsRow, SearchConsolePort } from './search-console.port';

const API = 'https://searchconsole.googleapis.com/webmasters/v3';

export function createLiveSearchConsolePort(accessToken: string): SearchConsolePort {
  return {
    source: 'GSC_LIVE',
    configured: true,
    async listVerifiedSites() {
      const res = await fetch(`${API}/sites`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`GSC sites ${res.status}`);
      const body = (await res.json()) as { siteEntry?: Array<{ siteUrl: string }> };
      return (body.siteEntry ?? []).map((e) => e.siteUrl);
    },
    async querySearchAnalytics(request: SearchAnalyticsRequest): Promise<SearchAnalyticsRow[]> {
      const site = encodeURIComponent(request.siteUrl);
      const res = await fetch(`${API}/sites/${site}/searchAnalytics/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: request.startDate,
          endDate: request.endDate,
          dimensions: ['query', 'page'],
          rowLimit: request.rowLimit ?? 25,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GSC analytics ${res.status}: ${text.slice(0, 180)}`);
      }
      const body = (await res.json()) as {
        rows?: Array<{
          keys?: string[];
          clicks?: number;
          impressions?: number;
          ctr?: number;
          position?: number;
        }>;
      };
      return (body.rows ?? []).map((row) => ({
        query: row.keys?.[0] ?? '',
        page: row.keys?.[1] ?? null,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      }));
    },
  };
}