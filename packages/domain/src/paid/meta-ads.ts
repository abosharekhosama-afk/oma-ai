/**
 * DEC-029 4.8: Meta Ads insights, READ-ONLY. OMA asks for `ads_read` only and never
 * creates, edits, pauses or spends on ads. Insights become PaidSpendEntry rows
 * (source META_API) that feed flight pacing (4.7).
 */
import { seoFixturesAllowed } from '../seo/ports-factory';

export type MetaAdsMode = 'disabled' | 'fixture' | 'live';

/** Live needs META_ADS_MODE=live + META_APP_ID/SECRET; fixture is dev/CI only (never production). */
export function metaAdsModeFromEnv(env: NodeJS.ProcessEnv = process.env): MetaAdsMode {
  const raw = (env.META_ADS_MODE ?? '').trim().toLowerCase();
  if (raw === 'live') return env.META_APP_ID && env.META_APP_SECRET ? 'live' : 'disabled';
  if (raw === 'fixture') return seoFixturesAllowed(env) ? 'fixture' : 'disabled';
  return 'disabled';
}

export const META_ADS_SCOPES = ['ads_read'] as const;

export type MetaAdAccount = { id: string; name: string; currency: string; status: number };

export type MetaInsightRow = {
  date: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  currency: string;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
};

type FetchLike = typeof fetch;
const GRAPH = 'https://graph.facebook.com';

export class MetaAdsClient {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  private get v() {
    return this.env.META_GRAPH_VERSION || 'v21.0';
  }

  authorizeUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({
      client_id: this.env.META_APP_ID ?? '',
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: META_ADS_SCOPES.join(','),
    });
    return `https://www.facebook.com/${this.v}/dialog/oauth?${q}`;
  }

  private async get(path: string, params: Record<string, string>) {
    const url = path.startsWith('https://')
      ? path
      : `${GRAPH}/${this.v}/${path}?${new URLSearchParams(params)}`;
    const res = await this.fetchFn(url);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = (body.error ?? {}) as { message?: string; code?: number };
      const e = new Error(`Meta ads ${res.status}: ${err.message ?? 'request failed'}`) as Error & {
        status?: number;
        code?: number;
      };
      e.status = res.status;
      e.code = err.code;
      throw e;
    }
    return body;
  }

  /** Code → long-lived (≈60 day) user token. */
  async exchangeCode(code: string, redirectUri: string) {
    const short = await this.get('oauth/access_token', {
      client_id: this.env.META_APP_ID ?? '',
      client_secret: this.env.META_APP_SECRET ?? '',
      redirect_uri: redirectUri,
      code,
    });
    const long = await this.get('oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: this.env.META_APP_ID ?? '',
      client_secret: this.env.META_APP_SECRET ?? '',
      fb_exchange_token: String(short.access_token),
    });
    const expiresIn = Number(long.expires_in);
    return {
      accessToken: String(long.access_token),
      expiresAt:
        Number.isFinite(expiresIn) && expiresIn > 0
          ? new Date(Date.now() + expiresIn * 1000)
          : null,
    };
  }

  async listAdAccounts(token: string): Promise<MetaAdAccount[]> {
    const body = await this.get('me/adaccounts', {
      access_token: token,
      fields: 'id,name,currency,account_status',
      limit: '100',
    });
    return ((body.data as Array<Record<string, unknown>>) ?? []).map((a) => ({
      id: String(a.id),
      name: String(a.name ?? a.id),
      currency: String(a.currency ?? 'USD'),
      status: Number(a.account_status ?? 0),
    }));
  }

  /** Daily campaign-level insights in [since, until] (inclusive, account timezone). */
  async insights(
    token: string,
    accountId: string,
    since: string,
    until: string,
  ): Promise<MetaInsightRow[]> {
    const act = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
    let body = await this.get(`${act}/insights`, {
      access_token: token,
      level: 'campaign',
      time_increment: '1',
      fields:
        'campaign_id,campaign_name,spend,impressions,clicks,actions,account_currency,date_start',
      time_range: JSON.stringify({ since, until }),
      limit: '500',
    });
    const rows: MetaInsightRow[] = [];
    for (let page = 0; page < 20; page++) {
      for (const r of (body.data as Array<Record<string, unknown>>) ?? []) rows.push(mapInsight(r));
      const next = (body.paging as { next?: string } | undefined)?.next;
      if (!next) break;
      body = await this.get(next, {});
    }
    return rows;
  }
}

const CONVERSION_ACTIONS = [
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'lead',
  'complete_registration',
];

export function mapInsight(r: Record<string, unknown>): MetaInsightRow {
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const actions = (r.actions as Array<{ action_type: string; value: string }>) ?? [];
  const conv = actions
    .filter((a) => CONVERSION_ACTIONS.includes(a.action_type))
    .reduce((t, a) => t + (Number(a.value) || 0), 0);
  return {
    date: String(r.date_start ?? '').slice(0, 10),
    campaign_id: String(r.campaign_id ?? ''),
    campaign_name: String(r.campaign_name ?? ''),
    spend: Math.round((num(r.spend) ?? 0) * 100) / 100,
    currency: String(r.account_currency ?? 'USD').toUpperCase(),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    conversions: actions.length ? conv : null,
  };
}

/**
 * Tie a Meta campaign to a plan flight: the campaign name contains "[flight-key]",
 * or equals the flight name (case-insensitive). Otherwise the spend stays unassigned.
 */
export function flightKeyForCampaign(
  campaignName: string,
  flights: Array<{ key: string; name: string }>,
): string {
  const tag = campaignName.match(/\[([a-z0-9][a-z0-9-]*)\]/i)?.[1]?.toLowerCase();
  if (tag && flights.some((f) => f.key === tag)) return tag;
  const byName = flights.find(
    (f) => f.name.trim().toLowerCase() === campaignName.trim().toLowerCase(),
  );
  return byName?.key ?? '';
}

/** Deterministic sample insights for dev/CI (labelled; never in production). */
export function fixtureMetaInsights(
  since: string,
  until: string,
  flights: Array<{ key: string; name: string }>,
) {
  const out: MetaInsightRow[] = [];
  const start = new Date(`${since}T00:00:00Z`).getTime();
  const end = new Date(`${until}T00:00:00Z`).getTime();
  const campaigns = [
    ...flights.slice(0, 2).map((f) => ({ id: `fx-${f.key}`, name: `${f.name} [${f.key}]` })),
    { id: 'fx-always-on', name: 'Always-on retargeting' },
  ];
  for (let t = start, i = 0; t <= end && i < 120; t += 86_400_000, i++) {
    campaigns.forEach((c, j) =>
      out.push({
        date: new Date(t).toISOString().slice(0, 10),
        campaign_id: c.id,
        campaign_name: c.name,
        spend: 40 + j * 15,
        currency: 'SAR',
        impressions: 5000 + j * 1000,
        clicks: 60 + j * 10,
        conversions: j === 0 ? 2 : null,
      }),
    );
  }
  return out;
}

/**
 * When the same platform/day/flight has API-synced rows, they win over manual/CSV rows
 * for that key, so connecting Meta after importing CSVs never double-counts spend.
 */
export function preferApiSpend<
  T extends { platform: string; spendDate: Date; flightKey: string; source: string },
>(rows: T[]): T[] {
  const apiKeys = new Set(
    rows
      .filter((r) => r.source.startsWith('META_'))
      .map((r) => `${r.platform}|${r.spendDate.toISOString().slice(0, 10)}|${r.flightKey}`),
  );
  return rows.filter(
    (r) =>
      r.source.startsWith('META_') ||
      !apiKeys.has(`${r.platform}|${r.spendDate.toISOString().slice(0, 10)}|${r.flightKey}`),
  );
}
