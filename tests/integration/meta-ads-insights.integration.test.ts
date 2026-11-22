import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  authHeaders,
  bringToApproved,
  createBrand,
  getStrategyVersion,
  seedBothTracksReadyStrategy,
  seedBrandTenant,
  type BrandSeed,
} from '../helpers/strategy-test';

/** DEC-029 4.8: read-only Meta Ads insights → spend rows → flight pacing (fixture mode). */
describe('meta ads insights (read-only)', () => {
  let seed: BrandSeed;
  const prevMode = process.env.META_ADS_MODE;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });
  afterAll(async () => {
    process.env.META_ADS_MODE = prevMode;
    await seed.app.close();
  });

  it('is off by default, syncs fixture insights into flights, and API rows win over CSV', async () => {
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const brandBase = `${seed.baseUrl}/api/v1/brands/${brandId}`;
    const send = (method: string, url: string, body?: unknown) =>
      fetch(url, {
        method,
        headers: authHeaders(seed),
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    delete process.env.META_ADS_MODE;
    const offRes = await fetch(`${brandBase}/meta-ads`, { headers: authHeaders(seed) });
    const off = await offRes.json();
    expect(off.data).toMatchObject({ mode: 'disabled', read_only: true, scopes: ['ads_read'] });
    expect((await send('POST', `${brandBase}/meta-ads/oauth/start`, {})).status).toBe(503);

    const { strategyId, versionId, rowVersion } = await seedBothTracksReadyStrategy(seed, brandId);
    const base = `${brandBase}/strategies/${strategyId}/versions/${versionId}`;
    const today = new Date();
    const day = (o: number) =>
      new Date(today.getTime() + o * 86_400_000).toISOString().slice(0, 10);
    const put = await send('PUT', `${base}/plan/paid`, {
      row_version: rowVersion,
      allocations: [{ platform: 'META', objective: 'AWARENESS', share_pct: 100 }],
      flights: [
        {
          key: 'launch',
          name: 'Launch',
          platform: 'META',
          start_date: day(-6),
          end_date: day(23),
          budget_amount: 3000,
          currency: 'SAR',
        },
      ],
    });
    expect(put.status).toBe(200);
    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    await bringToApproved(seed, brandId, strategyId, versionId, version.body.data.row_version);

    // CSV first (same days + flight) — must be superseded by the API rows.
    const csv = `date,platform,amount,currency,flight\n${day(-1)},META,999,SAR,launch`;
    expect(
      (await (await send('POST', `${brandBase}/paid-spend/import`, { csv })).json()).data.imported,
    ).toBe(true);

    process.env.META_ADS_MODE = 'fixture';
    const start = await (await send('POST', `${brandBase}/meta-ads/oauth/start`, {})).json();
    expect(start.data).toMatchObject({ connected: true, mode: 'fixture' });
    const accounts = await (
      await fetch(`${brandBase}/meta-ads/accounts`, { headers: authHeaders(seed) })
    ).json();
    expect(accounts.data[0].id).toBe('act_fixture');
    expect(
      (await send('POST', `${brandBase}/meta-ads/account`, { ad_account_id: 'act_nope' })).status,
    ).toBe(400);
    expect(
      (await send('POST', `${brandBase}/meta-ads/account`, { ad_account_id: 'act_fixture' }))
        .status,
    ).toBe(200);

    const sync = await (await send('POST', `${brandBase}/meta-ads/sync`, { days: 7 })).json();
    expect(sync.data).toMatchObject({ ok: true, days: 7, source: 'META_FIXTURE' });
    // 7 days × (launch + unassigned always-on) = 14 aggregated rows.
    expect(sync.data.rows).toBe(14);
    const again = await (await send('POST', `${brandBase}/meta-ads/sync`, { days: 7 })).json();
    expect(again.data.rows).toBe(14);
    const stored = await getPrisma().paidSpendEntry.count({
      where: { tenantId: seed.tenantId, brandId, source: 'META_FIXTURE' },
    });
    expect(stored).toBe(14);

    const exec = await (
      await fetch(`${base}/paid-execution`, { headers: authHeaders(seed) })
    ).json();
    const flight = exec.data.flights[0];
    // Fixture: 40 SAR/day for the tagged flight; 7 days inside the flight window → 280 (CSV 999 dropped).
    expect(flight).toMatchObject({
      key: 'launch',
      actual_spend: 280,
      spend_sources: ['META_FIXTURE'],
    });
    expect(exec.data.totals.unassigned_spend).toBe(7 * 55);

    const status = await (
      await fetch(`${brandBase}/meta-ads`, { headers: authHeaders(seed) })
    ).json();
    expect(status.data).toMatchObject({ status: 'FIXTURE', ad_account_id: 'act_fixture' });
    expect(status.data.last_sync_at).toBeTruthy();
    expect((await send('POST', `${brandBase}/meta-ads/disconnect`, {})).status).toBe(200);
    const audit = await getPrisma().auditEvent.count({
      where: { tenantId: seed.tenantId, action: { startsWith: 'paid.meta_ads.' } },
    });
    expect(audit).toBeGreaterThanOrEqual(5);
  });
});
