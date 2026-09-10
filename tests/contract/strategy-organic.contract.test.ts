import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  getStrategyVersion,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy organic contract', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('organic endpoint round-trip', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    const base = `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${strategyId}/versions/${versionId}`;
    const row = created.data.latest_version.row_version;
    const enable = await fetch(`${base}/tracks/enablement`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: row,
        organic_enabled: true,
        paid_enabled: false,
        paid_disabled_rationale: 'later',
      }),
    });
    expect([200, 201]).toContain(enable.status);
    const ver = await getStrategyVersion(seed, brand.data.id, strategyId, versionId);
    const trackRow = ver.body.data.organic?.row_version as number;
    const organic = await fetch(`${base}/organic`, {
      method: 'PATCH',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: trackRow,
        channels: [{ value: 'LinkedIn', infoClass: 'USER_AUTHORED' }],
      }),
    });
    expect([200, 201]).toContain(organic.status);
  });
});
