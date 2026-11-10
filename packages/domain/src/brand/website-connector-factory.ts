import { createFixtureWebsiteConnector } from '../ports/fixture-website-connector';
import {
  createLiveWebsiteConnector,
  liveConnectorOptionsFromEnv,
} from '../ports/live-website-connector';
import { refusingWebsiteConnector } from '../ports/refusing-adapters';
import type { WebsiteConnectorPort } from '../ports/website-connector.port';
import { isBrandFixtureConnectorEnabled } from './fixture-connector-env';

export type BrandWebsiteConnectorChoice = 'live' | 'fixture' | 'disabled';
export type BrandConnectorMode = 'LIVE' | 'FIXTURE' | 'NOT_CONFIGURED';

export function resolveBrandWebsiteConnectorChoice(
  env: NodeJS.ProcessEnv = process.env,
): BrandWebsiteConnectorChoice {
  const explicit = env.BRAND_WEBSITE_CONNECTOR?.trim().toLowerCase();
  if (explicit === 'fixture') {
    return env.NODE_ENV === 'production' ? 'disabled' : 'fixture';
  }
  if (explicit === 'disabled') return 'disabled';
  if (explicit === 'live') return 'live';
  if (isBrandFixtureConnectorEnabled(env)) return 'fixture';
  return 'live';
}

export function brandConnectorMode(env: NodeJS.ProcessEnv = process.env): BrandConnectorMode {
  const choice = resolveBrandWebsiteConnectorChoice(env);
  if (choice === 'live') return 'LIVE';
  if (choice === 'fixture') return 'FIXTURE';
  return 'NOT_CONFIGURED';
}

export function createWebsiteConnector(env: NodeJS.ProcessEnv = process.env): WebsiteConnectorPort {
  const choice = resolveBrandWebsiteConnectorChoice(env);
  if (choice === 'fixture') return createFixtureWebsiteConnector();
  if (choice === 'live') return createLiveWebsiteConnector(liveConnectorOptionsFromEnv(env));
  return refusingWebsiteConnector;
}
