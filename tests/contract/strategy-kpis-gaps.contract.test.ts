import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy kpis-gaps contract', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('kpis-gaps endpoint round-trip', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const base = `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${created.data.id}/versions/${created.data.latest_version.id}`;

    const kpi = await fetch(`${base}/kpis`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ name: 'Sessions', applies_to: 'ORGANIC' }),
    });
    expect([200, 201]).toContain(kpi.status);
    const gap = await fetch(`${base}/gaps`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ kind: 'UNKNOWN', text: 'Spend unknown', info_class: 'UNKNOWN' }),
    });
    expect([200, 201]).toContain(gap.status);
  });
});
