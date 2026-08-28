import { isBrandFixtureConnectorEnabled } from '@oma/domain';

export type BrandConnectorMode = 'FIXTURE' | 'NOT_CONFIGURED';

/**
 * No live crawl vendor is selected yet (DEC-004). Responses state which
 * connector is available so the UI never implies a live website fetch.
 */
export function brandConnectorMode(): BrandConnectorMode {
  return isBrandFixtureConnectorEnabled() ? 'FIXTURE' : 'NOT_CONFIGURED';
}
