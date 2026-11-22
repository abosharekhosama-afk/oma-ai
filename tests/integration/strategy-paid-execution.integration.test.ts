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

/** DEC-029 4.7: paid flights → campaigns, experiment results after approval, CSV spend + pacing. */
describe('paid execution', () => {
  let seed: BrandSeed;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });
  afterAll(async () => {
    await seed.app.close();
  });

  it('plans flights, records audited experiment results and paces imported spend', async () => {
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const { strategyId, versionId, rowVersion } = await seedBothTracksReadyStrategy(seed, brandId);
    const base = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`;
    const send = (method: string, url: string, body?: unknown) =>
      fetch(url, {
        method,
        headers: authHeaders(seed),
        body: body === undefined ? undefined : JSON.stringify(body),
      });

    const today = new Date();
    const day = (offset: number) =>
      new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    const paidPlan = {
      allocations: [{ platform: 'INSTAGRAM', objective: 'AWARENESS', share_pct: 100 }],
      audiences: [{ key: 'gulf-women', name: 'Gulf women', targeting: { locations: ['SA'] } }],
      experiments: [
        {
          name: 'Hook test',
          hypothesis: 'UGC beats studio',
          variable: 'CREATIVE',
          variants: [
            { key: 'A', description: 'UGC' },
            { key: 'B', description: 'Studio' },
          ],
          primary_metric: 'CTR',
        },
      ],
      flights: [
        {
          key: 'launch',
          name: 'Launch flight',
          platform: 'INSTAGRAM',
          objective: 'AWARENESS',
          audience_key: 'gulf-women',
          start_date: day(-9),
          end_date: day(20),
          budget_amount: 3000,
          currency: 'SAR',
        },
      ],
    };
    const bad = await send('PUT', `${base}/plan/paid`, {
      row_version: rowVersion,
      ...paidPlan,
      flights: [{ ...paidPlan.flights[0], end_date: day(-20) }],
    });
    expect(bad.status).toBe(400);
    const put = await send('PUT', `${base}/plan/paid`, { row_version: rowVersion, ...paidPlan });
    expect(put.status).toBe(200);
    const putBody = await put.json();
    expect(putBody.data.paid.flights[0]).toMatchObject({ key: 'launch', budget_amount: 3000 });

    // Omitting flights keeps them.
    const keep = await send('PUT', `${base}/plan/paid`, {
      row_version: putBody.data.row_version,
      allocations: paidPlan.allocations,
      audiences: paidPlan.audiences,
      experiments: paidPlan.experiments,
    });
    expect((await keep.json()).data.paid.flights).toHaveLength(1);

    const exp0 = await getPrisma().strategyExperiment.findFirstOrThrow({
      where: { strategyVersionId: versionId },
    });
    // Drafts: results are not recordable here.
    expect(
      (await send('POST', `${base}/experiments/${exp0.id}/status`, { status: 'RUNNING' })).status,
    ).toBe(409);

    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    await bringToApproved(seed, brandId, strategyId, versionId, version.body.data.row_version);

    const camps = await (await send('POST', `${base}/paid-flights/campaigns`)).json();
    expect(camps.data.created_campaign_ids).toHaveLength(1);
    const again = await (await send('POST', `${base}/paid-flights/campaigns`)).json();
    expect(again.data).toMatchObject({ created_campaign_ids: [], skipped: 1 });
    const campaign = await getPrisma().campaign.findFirstOrThrow({
      where: { id: camps.data.created_campaign_ids[0] },
    });
    expect(campaign).toMatchObject({ track: 'PAID', status: 'DRAFT', budgetAmount: 3000 });

    const exp = await getPrisma().strategyExperiment.findFirstOrThrow({
      where: { strategyVersionId: versionId },
    });
    expect(
      (await send('POST', `${base}/experiments/${exp.id}/status`, { status: 'CONCLUDED' })).status,
    ).toBe(409);
    expect(
      (await send('POST', `${base}/experiments/${exp.id}/status`, { status: 'RUNNING' })).status,
    ).toBe(200);
    const noSummary = await send('POST', `${base}/experiments/${exp.id}/status`, {
      status: 'CONCLUDED',
      winner_variant_key: 'A',
    });
    expect(noSummary.status).toBe(400);
    const wrongVariant = await send('POST', `${base}/experiments/${exp.id}/status`, {
      status: 'CONCLUDED',
      result_summary: 'x',
      winner_variant_key: 'Z',
    });
    expect(wrongVariant.status).toBe(400);
    const concluded = await send('POST', `${base}/experiments/${exp.id}/status`, {
      status: 'CONCLUDED',
      result_summary: 'UGC won: CTR 1.9% vs 1.2%',
      winner_variant_key: 'A',
      results: [
        { variant_key: 'A', value: 1.9, sample_size: 12000 },
        { variant_key: 'B', value: 1.2, sample_size: 11800 },
      ],
    });
    expect(concluded.status).toBe(200);
    const history = await (
      await fetch(`${base}/experiments/${exp.id}/history`, { headers: authHeaders(seed) })
    ).json();
    expect(history.data.map((h: { after: { status: string } }) => h.after.status)).toEqual([
      'RUNNING',
      'CONCLUDED',
    ]);
    expect(history.data[1].before.status).toBe('RUNNING');

    const brandBase = `${seed.baseUrl}/api/v1/brands/${brandId}`;
    const badCsv = await (
      await send('POST', `${brandBase}/paid-spend/import`, {
        csv: `Day,Platform,Amount Spent,Currency\n${day(-1)},Instagram,abc,SAR\n${day(-2)},Myspace,10,SAR`,
      })
    ).json();
    expect(badCsv.data).toMatchObject({ imported: false });
    expect(badCsv.data.errors.map((e: { code: string }) => e.code)).toEqual([
      'INVALID_AMOUNT',
      'UNKNOWN_PLATFORM',
    ]);
    const csv = [
      'Day,Platform,Amount Spent,Currency,Impressions,Link clicks,Flight',
      `${day(-3)},Instagram,400,SAR,10000,120,launch`,
      `${day(-3)},Instagram,100,SAR,"2,000",30,launch`,
      `${day(-2)},Instagram,300.50,SAR,8000,90,launch`,
      `${day(-2)},TikTok,50,SAR,1000,10,`,
    ].join('\n');
    const imported = await (await send('POST', `${brandBase}/paid-spend/import`, { csv })).json();
    expect(imported.data).toMatchObject({ imported: true, created: 3, updated: 0 });
    const reimported = await (await send('POST', `${brandBase}/paid-spend/import`, { csv })).json();
    expect(reimported.data).toMatchObject({ created: 0, updated: 3 });
    const unknownFlight = await send('POST', `${brandBase}/paid-spend`, {
      entries: [
        { date: day(-1), platform: 'INSTAGRAM', amount: 5, currency: 'SAR', flight_key: 'nope' },
      ],
    });
    expect(unknownFlight.status).toBe(400);

    const exec = await (
      await fetch(`${base}/paid-execution`, { headers: authHeaders(seed) })
    ).json();
    const flight = exec.data.flights[0];
    // 30-day flight, day 10 → expected 1000; actual 800.5 → 80% = underspending.
    expect(flight).toMatchObject({
      key: 'launch',
      campaign_id: campaign.id,
      actual_spend: 800.5,
      expected_spend: 1000,
      pacing_pct: 80,
      status: 'underspending',
      impressions: 20000,
      clicks: 240,
    });
    expect(exec.data.totals).toMatchObject({ planned_budget: 3000, unassigned_spend: 50 });
    expect(exec.data.experiments[0]).toMatchObject({
      status: 'CONCLUDED',
      winner_variant_key: 'A',
    });

    const spend = await (
      await fetch(`${brandBase}/paid-spend?from=${day(-7)}&to=${day(0)}`, {
        headers: authHeaders(seed),
      })
    ).json();
    expect(spend.data.by_platform).toMatchObject({
      INSTAGRAM: { amount: 800.5, currency: 'SAR' },
      TIKTOK: { amount: 50 },
    });
  });
});
