import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy children CRUD contracts', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  async function setup() {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    return {
      seed,
      brandId: brand.data.id as string,
      strategyId: created.data.id as string,
      versionId: created.data.latest_version.id as string,
    };
  }

  it('audiences create/delete', async () => {
    const ctx = await setup();
    const base = `${ctx.seed.baseUrl}/api/v1/brands/${ctx.brandId}/strategies/${ctx.strategyId}/versions/${ctx.versionId}`;
    const created = await fetch(`${base}/audiences`, {
      method: 'POST',
      headers: authHeaders(ctx.seed),
      body: JSON.stringify({ name: 'Ops', info_class: 'USER_AUTHORED' }),
    });
    expect([200, 201]).toContain(created.status);
    const body = await created.json();
    const del = await fetch(`${base}/audiences/${body.data.id}`, {
      method: 'DELETE',
      headers: authHeaders(ctx.seed),
    });
    expect([200, 201]).toContain(del.status);
  });

  it('competitors/kpis/gaps/evidence-links', async () => {
    const ctx = await setup();
    const base = `${ctx.seed.baseUrl}/api/v1/brands/${ctx.brandId}/strategies/${ctx.strategyId}/versions/${ctx.versionId}`;
    const headers = authHeaders(ctx.seed);
    const competitor = await fetch(`${base}/competitors`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: 'Rival',
        source_url: 'https://example.com',
        source_note: 'manual',
        uncertainty: 'medium',
      }),
    });
    expect([200, 201]).toContain(competitor.status);
    const kpi = await fetch(`${base}/kpis`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Sessions', applies_to: 'ORGANIC' }),
    });
    expect([200, 201]).toContain(kpi.status);
    const gap = await fetch(`${base}/gaps`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ kind: 'UNKNOWN', text: 'Spend unknown', info_class: 'UNKNOWN' }),
    });
    expect([200, 201]).toContain(gap.status);
    const link = await fetch(`${base}/evidence-links`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ label: 'Note only' }),
    });
    expect([200, 201]).toContain(link.status);
  });

  it('organic enablement + paid patch planning markers', async () => {
    const ctx = await setup();
    const base = `${ctx.seed.baseUrl}/api/v1/brands/${ctx.brandId}/strategies/${ctx.strategyId}/versions/${ctx.versionId}`;
    const headers = authHeaders(ctx.seed);
    const en = await fetch(`${base}/tracks/enablement`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        row_version: 1,
        organic_enabled: true,
        paid_enabled: true,
      }),
    });
    expect([200, 201]).toContain(en.status);
    const paid = await fetch(`${base}/paid`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ row_version: 1, budget_amount: '5000', budget_currency: 'USD' }),
    });
    expect([200, 201]).toContain(paid.status);
    const body = await paid.json();
    expect(body.data.paid.planning_only).toBe(true);
  });
});
