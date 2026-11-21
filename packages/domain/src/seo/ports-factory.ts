import { manualResearchAdapter, type StrategyResearchPort } from '../strategy/research-port';
import { externalFixtureKeywordSearch, asStrategyResearchPort } from './keyword-search.port';
import { createLiveSearchConsolePort } from './search-console-live';
import { fixtureSearchConsolePort } from './search-console-fixture';
import { refusingSearchConsolePort, type SearchConsolePort } from './search-console.port';

export type GscMode = 'disabled' | 'fixture' | 'live';

export function gscModeFromEnv(env: NodeJS.ProcessEnv = process.env): GscMode {
  const raw = (env.BRAND_GSC_MODE ?? 'fixture').trim().toLowerCase();
  if (raw === 'live') return 'live';
  if (raw === 'disabled' || raw === 'off') return 'disabled';
  return 'fixture';
}

export function keywordSearchModeFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return (env.BRAND_KEYWORD_RESEARCH_MODE ?? 'external_fixture').trim().toLowerCase();
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

export function createKeywordResearchPort(env: NodeJS.ProcessEnv = process.env): StrategyResearchPort {
  const mode = keywordSearchModeFromEnv(env);
  if (mode === 'external_fixture' || mode === 'fixture') {
    return asStrategyResearchPort(externalFixtureKeywordSearch);
  }
  if (mode === 'manual') return manualResearchAdapter;
  return asStrategyResearchPort(externalFixtureKeywordSearch);
}