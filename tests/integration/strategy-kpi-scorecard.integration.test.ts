import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import type { INestApplication } from '@nestjs/common';
import { createBrand } from '../helpers/brand-test';
import {
  authHeaders,
  bringToApproved,
  getStrategyVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

/** DEC-029 4.5: KPIs bound to measurable metrics, manual otherwise; scorecard + audited manual values. */
describe('strategy KPI scorecard', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('measures bound KPIs from plan content and records manual KPIs with an audit trail', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { strategyId, versionId, rowVersion } = await seedReviewReadyStrategy(seed, brandId);
    const base = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`;
    const post = (path: string, body: unknown) =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify(body),
      });

    expect((await post('/kpis', { name: 'Bad', metric: 'followers_magic' })).status).toBe(400);
    const published = await (
      await post('/kpis', {
        name: 'Posts',
        metric: 'posts_published',
        target_number: 2,
        period: 'WEEK',
      })
    ).json();
    const rate = await (
      await post('/kpis', {
        name: 'On-time',
        metric: 'publish_rate',
        target_value: '80%',
        period: 'WEEK',
      })
    ).json();
    const manual = await (await post('/kpis', { name: 'Awareness', target_value: '50' })).json();
    expect(manual.data.metric).toBeNull();

    const put = await fetch(`${base}/plan/organic`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: rowVersion,
        pillars: [{ key: 'edu', name_en: 'Education', name_ar: 'تثقيف', share_target_pct: 100 }],
        cadence: [{ channel: 'Instagram', posts_per_week: 2 }],
      }),
    });
    expect(put.status).toBe(200);
    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    const detailKpis = version.body.data.kpis as Array<Record<string, unknown>>;
    expect(detailKpis.find((k) => k.id === rate.data.id)).toMatchObject({
      metric: 'publish_rate',
      measurable: true,
      target_number: 80,
      period: 'WEEK',
    });
    await bringToApproved(seed, brandId, strategyId, versionId, version.body.data.row_version);

    const commit = await (
      await post('/plan-to-requests/commit', { calendar: { start_date: '2026-12-07', weeks: 1 } })
    ).json();
    const ids = commit.data.created_content_ids as string[];
    expect(ids).toHaveLength(2);
    const day = 86_400_000;
    await getPrisma().contentItem.update({
      where: { id: ids[0]! },
      data: { plannedAt: new Date(Date.now() - 2 * day), publishedAt: new Date(Date.now() - day) },
    });
    await getPrisma().contentItem.update({
      where: { id: ids[1]! },
      data: { plannedAt: new Date(Date.now() - day) },
    });

    const card = await (
      await fetch(`${base}/kpi-scorecard`, { headers: authHeaders(seed) })
    ).json();
    const byId = Object.fromEntries(
      (card.data.kpis as Array<{ id: string }>).map((k) => [k.id, k]),
    ) as Record<string, Record<string, unknown>>;
    expect(byId[published.data.id]).toMatchObject({
      source: 'measured',
      actual: 1,
      progress_pct: 50,
      status: 'behind',
    });
    expect(byId[rate.data.id]).toMatchObject({ actual: 50, status: 'behind', unit: 'percent' });
    expect(byId[manual.data.id]).toMatchObject({
      source: 'manual',
      actual: null,
      status: 'not_recorded',
    });
    expect(card.data.summary).toMatchObject({ total: 3, measured: 2, manual: 1 });

    // Approved version: KPI definitions are immutable, results are still recordable.
    expect((await post('/kpis', { name: 'Late' })).status).toBe(409);
    expect((await post(`/kpi-scorecard/${published.data.id}/manual`, { value: 5 })).status).toBe(
      409,
    );
    expect((await post(`/kpi-scorecard/${manual.data.id}/manual`, { value: 'x' })).status).toBe(
      400,
    );
    const rec = await post(`/kpi-scorecard/${manual.data.id}/manual`, {
      value: 60,
      note: 'survey',
    });
    expect(rec.status).toBe(200);
    const after = await (
      await fetch(`${base}/kpi-scorecard`, { headers: authHeaders(seed) })
    ).json();
    expect(
      (after.data.kpis as Array<Record<string, unknown>>).find((k) => k.id === manual.data.id),
    ).toMatchObject({ actual: 60, note: 'survey', status: 'on_track', progress_pct: 120 });
    const audit = await getPrisma().auditEvent.findFirst({
      where: {
        tenantId: seed.tenantId,
        action: 'strategy.kpi.manual_recorded',
        targetId: manual.data.id,
      },
    });
    expect(audit?.afterRef).toContain('"value":60');
  });
});
