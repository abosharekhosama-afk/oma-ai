import { manualResearchAdapter, type StrategyResearchPort } from '../strategy/research-port';
import { externalFixtureKeywordSearch, asStrategyResearchPort } from './keyword-search.port';
import { createLiveSearchConsolePort } from './search-console-live';
import { createDataForSeoKeywordSearch, dataForSeoConfigFromEnv } from './dataforseo';
import { fixtureSearchConsolePort } from './search-console-fixture';
import { refusingSearchConsolePort, type SearchConsolePort } from './search-console.port';

export type GscMode = 'disabled' | 'fixture' | 'live';

/**
 * Sample (fixture) SEO data is for dev/CI and demos. In production it is off unless
 * `SEO_FIXTURES_ALLOWED=true` is set explicitly (DEC-029 4.0).
 */
export function seoFixturesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.SEO_FIXTURES_ALLOWED ?? '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  if ((env.NODE_ENV ?? '').trim().toLowerCase() === 'production') return false;
  // Hosted deploys (Render API, Vercel web) are real environments even when NODE_ENV is
  // unset: sample SEO rows leaked into a live brand that way. Opt in explicitly there.
  if (isHostedEnv(env)) return false;
  return true;
}

function isHostedEnv(env: NodeJS.ProcessEnv): boolean {
  return ['RENDER', 'VERCEL', 'RENDER_SERVICE_ID'].some((k) => Boolean((env[k] ?? '').trim()));
}

const FIXTURE_SOURCES = new Set(['FIXTURE', 'GSC_FIXTURE', 'EXTERNAL_FIXTURE']);

/** Sample SEO rows (keyword metrics, Search Console fixture snapshots, fixture gaps). */
export function isSeoFixtureSource(source: string | null | undefined): boolean {
  return FIXTURE_SOURCES.has(
    String(source ?? '')
      .trim()
      .toUpperCase(),
  );
}

/**
 * Read-side gate: rows persisted from sample data are hidden wherever fixtures are not
 * allowed, so older fixture rows never show in a real environment's strategy/SEO views.
 */
export function visibleSeoRows<T extends { source?: string | null }>(
  rows: T[],
  env: NodeJS.ProcessEnv = process.env,
): T[] {
  return seoFixturesAllowed(env) ? rows : rows.filter((row) => !isSeoFixtureSource(row.source));
}

export function gscModeFromEnv(env: NodeJS.ProcessEnv = process.env): GscMode {
  const fixturesOk = seoFixturesAllowed(env);
  const raw = (env.BRAND_GSC_MODE ?? (fixturesOk ? 'fixture' : 'disabled')).trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'disabled' || raw === 'off') return 'disabled';
  return fixturesOk ? 'fixture' : 'disabled';
}

export function keywordSearchModeFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  const fixturesOk = seoFixturesAllowed(env);
  const raw = (env.BRAND_KEYWORD_RESEARCH_MODE ?? (fixturesOk ? 'external_fixture' : 'manual'))
    .trim()
    .toLowerCase();
  if ((raw === 'external_fixture' || raw === 'fixture') && !fixturesOk) return 'manual';
  // DEC-029 4.6: DataForSEO only when the flag is set AND credentials exist; otherwise manual.
  if (raw === 'dataforseo') return dataForSeoConfigFromEnv(env) ? 'dataforseo' : 'manual';
  return raw;
}

export function createSearchConsolePort(
  accessToken?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): SearchConsolePort {
  const mode = gscModeFromEnv(env);
  if (mode === 'fixture') return fixtureSearchConsolePort;
  if (mode === 'live' && accessToken?.trim()) {
    return createLiveSearchConsolePort(accessToken.trim());
  }
  return refusingSearchConsolePort;
}

export function createKeywordResearchPort(
  env: NodeJS.ProcessEnv = process.env,
): StrategyResearchPort {
  const mode = keywordSearchModeFromEnv(env);
  if (mode === 'external_fixture' || mode === 'fixture') {
    return asStrategyResearchPort(externalFixtureKeywordSearch);
  }
  if (mode === 'dataforseo') {
    const config = dataForSeoConfigFromEnv(env);
    if (config) return asStrategyResearchPort(createDataForSeoKeywordSearch(config));
  }
  return manualResearchAdapter;
}
