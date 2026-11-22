import type { KeywordMetric, KeywordResearchRequest } from '../strategy/research-port';
import type { ExternalKeywordSearchPort } from './keyword-search.port';

/**
 * DEC-029 4.6: DataForSEO keyword metrics, behind BRAND_KEYWORD_RESEARCH_MODE=dataforseo
 * and only when DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are set. Without a key the
 * factory falls back to manual (no invented numbers).
 */
export type DataForSeoConfig = {
  login: string;
  password: string;
  baseUrl?: string;
  /** Default location (DataForSEO location_code); 2682 = Saudi Arabia. */
  locationCode?: number;
};

export function dataForSeoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DataForSeoConfig | null {
  const login = env.DATAFORSEO_LOGIN?.trim();
  const password = env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) return null;
  const loc = Number(env.DATAFORSEO_LOCATION_CODE);
  return {
    login,
    password,
    baseUrl: env.DATAFORSEO_BASE_URL?.trim() || undefined,
    locationCode: Number.isFinite(loc) && loc > 0 ? loc : undefined,
  };
}

/** Market (ISO-2) → DataForSEO location_code for the markets OMA serves. */
const LOCATION_CODES: Record<string, number> = {
  SA: 2682,
  AE: 2784,
  EG: 2818,
  KW: 2414,
  QA: 2634,
  BH: 2048,
  OM: 2512,
  JO: 2400,
  US: 2840,
  GB: 2826,
};

type DfsTask<T> = { status_code?: number; status_message?: string; result?: T[] | null };
type DfsResponse<T> = { status_code?: number; status_message?: string; tasks?: DfsTask<T>[] };

export function createDataForSeoKeywordSearch(
  config: DataForSeoConfig,
  fetchImpl: typeof fetch = fetch,
): ExternalKeywordSearchPort {
  const base = (config.baseUrl ?? 'https://api.dataforseo.com').replace(/\/+$/, '');
  const auth = `Basic ${Buffer.from(`${config.login}:${config.password}`).toString('base64')}`;
  const post = async <T>(path: string, body: unknown): Promise<T[]> => {
    const res = await fetchImpl(`${base}${path}`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`DataForSEO ${path} HTTP ${res.status}`);
    const json = (await res.json()) as DfsResponse<T>;
    if (json.status_code && json.status_code >= 40000) {
      throw new Error(`DataForSEO ${json.status_code}: ${json.status_message ?? ''}`.trim());
    }
    const task = json.tasks?.[0];
    if (task?.status_code && task.status_code >= 40000) {
      throw new Error(`DataForSEO task ${task.status_code}: ${task.status_message ?? ''}`.trim());
    }
    return task?.result ?? [];
  };

  return {
    provider: 'external_live',
    measured: true,
    async lookup(request: KeywordResearchRequest): Promise<KeywordMetric[]> {
      const byLocale = new Map<string, string[]>();
      for (const k of request.keywords.slice(0, 700)) {
        const locale = (k.locale || 'ar').slice(0, 2).toLowerCase();
        byLocale.set(locale, [...(byLocale.get(locale) ?? []), k.keyword.trim()]);
      }
      const location =
        (request.market && LOCATION_CODES[request.market.toUpperCase()]) ||
        config.locationCode ||
        2682;
      const out = new Map<string, KeywordMetric>();
      for (const [locale, keywords] of byLocale) {
        const params = [{ keywords, location_code: location, language_code: locale }];
        const volumes = await post<{
          keyword: string;
          search_volume: number | null;
          competition: string | null;
        }>('/v3/keywords_data/google_ads/search_volume/live', params);
        const difficulty = await post<{ items?: Array<{ keyword: string; keyword_difficulty: number | null }> }>(
          '/v3/dataforseo_labs/google/bulk_keyword_difficulty/live',
          [{ keywords, location_code: location, language_code: locale }],
        ).catch(() => []);
        const kd = new Map(
          difficulty.flatMap((r) => r.items ?? []).map((i) => [i.keyword.toLowerCase(), i.keyword_difficulty]),
        );
        for (const keyword of keywords) {
          const vol = volumes.find((v) => v.keyword.toLowerCase() === keyword.toLowerCase());
          out.set(`${locale}:${keyword.toLowerCase()}`, {
            keyword,
            locale,
            monthly_volume: vol?.search_volume ?? null,
            difficulty: kd.get(keyword.toLowerCase()) ?? null,
            intent: null,
            source: 'EXTERNAL',
          });
        }
      }
      return request.keywords.map(
        (k) =>
          out.get(`${(k.locale || 'ar').slice(0, 2).toLowerCase()}:${k.keyword.trim().toLowerCase()}`) ?? {
            keyword: k.keyword,
            locale: k.locale,
            monthly_volume: null,
            difficulty: null,
            intent: null,
            source: 'EXTERNAL',
          },
      );
    },
  };
}
