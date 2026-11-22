import { manualResearchAdapter, type StrategyResearchPort } from '../strategy/research-port';
import { externalFixtureKeywordSearch, asStrategyResearchPort } from './keyword-search.port';
import { createLiveSearchConsolePort } from './search-console-live';
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
  return (env.NODE_ENV ?? '').trim().toLowerCase() !== 'production';
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
  return manualResearchAdapter;
}
