import { describe, expect, it } from 'vitest';
import {
  MetaAdsClient,
  flightKeyForCampaign,
  mapInsight,
  metaAdsModeFromEnv,
  preferApiSpend,
} from './meta-ads';

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

describe('meta ads (read-only)', () => {
  it('mode: disabled by default, live needs app creds, fixture never in production', () => {
    expect(metaAdsModeFromEnv(env({}))).toBe('disabled');
    expect(metaAdsModeFromEnv(env({ META_ADS_MODE: 'live' }))).toBe('disabled');
    expect(
      metaAdsModeFromEnv(env({ META_ADS_MODE: 'live', META_APP_ID: 'a', META_APP_SECRET: 'b' })),
    ).toBe('live');
    expect(metaAdsModeFromEnv(env({ META_ADS_MODE: 'fixture', NODE_ENV: 'production' }))).toBe(
      'disabled',
    );
    expect(metaAdsModeFromEnv(env({ META_ADS_MODE: 'fixture', NODE_ENV: 'test' }))).toBe('fixture');
  });

  it('asks for ads_read only', () => {
    const url = new MetaAdsClient(env({ META_APP_ID: 'app' })).authorizeUrl('s', 'https://x/cb');
    expect(new URL(url).searchParams.get('scope')).toBe('ads_read');
  });

  it('maps insights and conversions', () => {
    expect(
      mapInsight({
        date_start: '2026-11-20',
        campaign_id: '1',
        campaign_name: 'Launch [launch]',
        spend: '12.345',
        impressions: '1000',
        clicks: '20',
        account_currency: 'sar',
        actions: [
          { action_type: 'purchase', value: '2' },
          { action_type: 'link_click', value: '9' },
        ],
      }),
    ).toEqual({
      date: '2026-11-20',
      campaign_id: '1',
      campaign_name: 'Launch [launch]',
      spend: 12.35,
      currency: 'SAR',
      impressions: 1000,
      clicks: 20,
      conversions: 2,
    });
  });

  it('ties campaigns to flights by [key] tag or exact name', () => {
    const flights = [
      { key: 'launch', name: 'Launch' },
      { key: 'ramadan', name: 'Ramadan push' },
    ];
    expect(flightKeyForCampaign('Big [LAUNCH] video', flights)).toBe('launch');
    expect(flightKeyForCampaign('ramadan push', flights)).toBe('ramadan');
    expect(flightKeyForCampaign('[unknown] x', flights)).toBe('');
  });

  it('paginates insights through paging.next', async () => {
    const pages = [
      {
        data: [{ date_start: '2026-11-01', spend: '1', campaign_name: 'a' }],
        paging: { next: 'https://graph.facebook.com/next' },
      },
      { data: [{ date_start: '2026-11-02', spend: '2', campaign_name: 'a' }] },
    ];
    const urls: string[] = [];
    const fetchFn = (async (u: string) => {
      urls.push(u);
      return new Response(JSON.stringify(pages.shift()), { status: 200 });
    }) as unknown as typeof fetch;
    const rows = await new MetaAdsClient(env({}), fetchFn).insights(
      't',
      '123',
      '2026-11-01',
      '2026-11-02',
    );
    expect(rows.map((r) => r.spend)).toEqual([1, 2]);
    expect(urls[0]).toContain('act_123/insights');
    expect(urls[1]).toBe('https://graph.facebook.com/next');
  });

  it('API rows win over CSV for the same platform/day/flight', () => {
    const d = new Date('2026-11-20T00:00:00Z');
    const rows = preferApiSpend([
      { platform: 'META', spendDate: d, flightKey: 'launch', source: 'CSV' },
      { platform: 'META', spendDate: d, flightKey: 'launch', source: 'META_API' },
      { platform: 'META', spendDate: d, flightKey: '', source: 'CSV' },
      { platform: 'TIKTOK', spendDate: d, flightKey: 'launch', source: 'CSV' },
    ]);
    expect(rows.map((r) => `${r.platform}:${r.flightKey}:${r.source}`)).toEqual([
      'META:launch:META_API',
      'META::CSV',
      'TIKTOK:launch:CSV',
    ]);
  });
});
