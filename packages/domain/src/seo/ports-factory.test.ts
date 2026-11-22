import { describe, expect, it } from 'vitest';
import {
  createKeywordResearchPort,
  gscModeFromEnv,
  keywordSearchModeFromEnv,
  seoFixturesAllowed,
} from './ports-factory';
import { buildSeoStrategyProposals } from './strategy-bridge';

const env = (v: Record<string, string>) => v as unknown as NodeJS.ProcessEnv;

describe('SEO data honesty (DEC-029 4.0)', () => {
  it('turns fixtures off in production unless explicitly allowed', () => {
    expect(seoFixturesAllowed(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(seoFixturesAllowed(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(seoFixturesAllowed(env({ NODE_ENV: 'production', SEO_FIXTURES_ALLOWED: 'true' }))).toBe(
      true,
    );
    expect(gscModeFromEnv(env({ NODE_ENV: 'production' }))).toBe('disabled');
    expect(gscModeFromEnv(env({ NODE_ENV: 'production', BRAND_GSC_MODE: 'fixture' }))).toBe(
      'disabled',
    );
    expect(gscModeFromEnv(env({ NODE_ENV: 'production', BRAND_GSC_MODE: 'live' }))).toBe('live');
    expect(keywordSearchModeFromEnv(env({ NODE_ENV: 'production' }))).toBe('manual');
    expect(
      keywordSearchModeFromEnv(
        env({ NODE_ENV: 'production', BRAND_KEYWORD_RESEARCH_MODE: 'external_fixture' }),
      ),
    ).toBe('manual');
  });

  it('labels fixture keyword metrics FIXTURE and never measured', async () => {
    const port = createKeywordResearchPort(env({ NODE_ENV: 'test' }));
    expect(port.measured).toBe(false);
    const [m] = await port.keywordMetrics({ keywords: [{ keyword: 'x', locale: 'en' }] });
    expect(m!.source).toBe('FIXTURE');
    const manual = createKeywordResearchPort(env({ NODE_ENV: 'production' }));
    const [n] = await manual.keywordMetrics({ keywords: [{ keyword: 'x', locale: 'en' }] });
    expect(n!.monthly_volume).toBeNull();
  });

  it('keeps Search Console impressions out of monthly volume', () => {
    const out = buildSeoStrategyProposals({
      scanAttemptId: null,
      auditScore: null,
      auditCreatedAt: null,
      gscLastSyncAt: null,
      findings: [],
      gscQueries: [
        {
          keyword: 'serum',
          locale: 'en',
          impressions: 1200,
          clicks: 40,
          position: 8,
          source: 'GSC_LIVE',
        },
        { keyword: 'toner', locale: 'en', impressions: 300, source: 'GSC_FIXTURE' },
      ],
    });
    const [live, fixture] = out.seo_keywords;
    expect(live).toMatchObject({
      monthly_volume: null,
      metric_source: null,
      gsc_impressions: 1200,
      gsc_clicks: 40,
      source: 'EXTERNAL',
    });
    expect(fixture!.source).toBe('FIXTURE');
  });
});
