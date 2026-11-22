import { describe, expect, it } from 'vitest';
import {
  briefContentFromSeoGaps,
  guessQueryLocale,
  isoWeekKey,
  pickSearchConsoleSite,
  rankStatus,
  seoKeywordGaps,
  weeklyRankSeries,
} from './rank-tracking';
import { createDataForSeoKeywordSearch, dataForSeoConfigFromEnv } from './dataforseo';
import { createKeywordResearchPort, keywordSearchModeFromEnv } from './ports-factory';
import { briefContentSchema } from '../work/brief-entity';

const now = new Date('2026-11-22T10:00:00Z');
const obs = (keyword: string, position: number | null, daysAgo: number, impressions = 100) => ({
  keyword,
  position,
  impressions,
  clicks: 1,
  capturedAt: new Date(now.getTime() - daysAgo * 86_400_000),
  source: 'GSC_LIVE',
});

describe('rank tracking', () => {
  it('iso weeks and statuses', () => {
    expect(isoWeekKey(new Date('2026-11-22T10:00:00Z'))).toBe('2026-W47');
    expect(isoWeekKey(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
    expect(rankStatus(2)).toBe('top3');
    expect(rankStatus(25)).toBe('striking');
    expect(rankStatus(null)).toBe('not_ranking');
    expect(guessQueryLocale('عناية')).toBe('ar');
  });

  it('picks the site matching the brand website', () => {
    const sites = ['https://other.com/', 'sc-domain:brand.sa', 'https://www.brand.sa/'];
    expect(pickSearchConsoleSite(sites, 'https://brand.sa/')).toBe('https://www.brand.sa/');
    expect(pickSearchConsoleSite(['sc-domain:brand.sa'], 'https://brand.sa')).toBe(
      'sc-domain:brand.sa',
    );
    expect(pickSearchConsoleSite(sites, null)).toBe('https://other.com/');
    expect(pickSearchConsoleSite([], 'https://brand.sa')).toBeNull();
  });

  it('keeps the latest snapshot per week', () => {
    const t = weeklyRankSeries([obs('A', 20, 8), obs('a', 12, 1), obs('A', 15, 0)], 3, now);
    expect(t.series('a').map((p) => p.position)).toEqual([null, 20, 15]);
  });

  it('finds gaps and builds a valid brief', () => {
    const gaps = seoKeywordGaps(
      [
        { keyword: 'night cream', locale: 'en', pillar_key: 'edu', priority: 1 },
        { keyword: 'serum', locale: 'en', pillar_key: 'edu', priority: 2 },
        { keyword: 'top', locale: 'en', pillar_key: null, priority: 3 },
      ],
      [obs('serum', 15, 1), obs('top', 2, 1), obs('random', 45, 1, 300), obs('tiny', 40, 1, 10)],
    );
    expect(gaps.map((g) => `${g.kind}:${g.keyword}`)).toEqual([
      'striking_distance:serum',
      'not_ranking:night cream',
      'unplanned_demand:random',
    ]);
    const content = briefContentSchema.parse(briefContentFromSeoGaps(gaps, now));
    expect(content.deliverables).toHaveLength(3);
    expect(content.pillar_key).toBe('edu');
  });
});

describe('DataForSEO', () => {
  it('is off without credentials, even when the flag asks for it', () => {
    expect(
      keywordSearchModeFromEnv({ BRAND_KEYWORD_RESEARCH_MODE: 'dataforseo' } as NodeJS.ProcessEnv),
    ).toBe('manual');
    expect(
      createKeywordResearchPort({ BRAND_KEYWORD_RESEARCH_MODE: 'dataforseo' } as NodeJS.ProcessEnv)
        .id,
    ).toBe('manual');
    const env = {
      BRAND_KEYWORD_RESEARCH_MODE: 'dataforseo',
      DATAFORSEO_LOGIN: 'l',
      DATAFORSEO_PASSWORD: 'p',
    } as NodeJS.ProcessEnv;
    expect(keywordSearchModeFromEnv(env)).toBe('dataforseo');
    expect(createKeywordResearchPort(env)).toMatchObject({ id: 'external', measured: true });
    expect(dataForSeoConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('maps volume and difficulty as EXTERNAL, unknowns as null', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push(`${url} ${(init.headers as Record<string, string>).Authorization}`);
      const body = url.includes('search_volume')
        ? {
            tasks: [
              {
                status_code: 20000,
                result: [{ keyword: 'serum', search_volume: 880, competition: 'LOW' }],
              },
            ],
          }
        : {
            tasks: [
              {
                status_code: 20000,
                result: [{ items: [{ keyword: 'serum', keyword_difficulty: 31 }] }],
              },
            ],
          };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const port = createDataForSeoKeywordSearch({ login: 'l', password: 'p' }, fetchImpl);
    const rows = await port.lookup({
      keywords: [
        { keyword: 'serum', locale: 'en' },
        { keyword: 'unknown', locale: 'en' },
      ],
      market: 'AE',
    });
    expect(rows).toEqual([
      {
        keyword: 'serum',
        locale: 'en',
        monthly_volume: 880,
        difficulty: 31,
        intent: null,
        source: 'EXTERNAL',
      },
      {
        keyword: 'unknown',
        locale: 'en',
        monthly_volume: null,
        difficulty: null,
        intent: null,
        source: 'EXTERNAL',
      },
    ]);
    expect(calls[0]).toContain(`Basic ${Buffer.from('l:p').toString('base64')}`);
  });

  it('surfaces provider errors instead of inventing numbers', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ status_code: 40100, status_message: 'auth' }), {
        status: 200,
      })) as unknown as typeof fetch;
    const port = createDataForSeoKeywordSearch({ login: 'l', password: 'p' }, fetchImpl);
    await expect(port.lookup({ keywords: [{ keyword: 'x', locale: 'ar' }] })).rejects.toThrow(
      '40100',
    );
  });
});
