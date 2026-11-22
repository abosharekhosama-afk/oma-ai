import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import { createBrand } from '../helpers/brand-test';
import {
  authHeaders,
  bringToApproved,
  getStrategyVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

/** DEC-029 4.6: weekly rank tracking of plan keywords; gaps → draft brief (fixture GSC). */
describe('seo rank tracking + gaps', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('tracks plan keywords by ISO week and turns gaps into a draft SEO brief', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const brandBase = `${seed.baseUrl}/api/v1/brands/${brandId}`;

    // No approved plan yet: nothing to track.
    const empty = await (
      await fetch(`${brandBase}/seo/rank-tracking`, { headers: authHeaders(seed) })
    ).json();
    expect(empty.data).toMatchObject({ strategy_version_id: null, keywords: [] });

    const { strategyId, versionId, rowVersion } = await seedReviewReadyStrategy(seed, brandId);
    const base = `${brandBase}/strategies/${strategyId}/versions/${versionId}`;
    const put = await fetch(`${base}/plan/organic`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: rowVersion,
        pillars: [{ key: 'edu', name_en: 'Education', name_ar: 'تثقيف', share_target_pct: 100 }],
        seo_keywords: [
          {
            keyword: 'organic skincare',
            intent: 'COMMERCIAL',
            pillar_key: 'edu',
            priority: 1,
            locale: 'en',
          },
          {
            keyword: 'night cream',
            intent: 'COMMERCIAL',
            pillar_key: 'edu',
            priority: 2,
            locale: 'en',
          },
        ],
      }),
    });
    expect(put.status).toBe(200);
    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    await bringToApproved(seed, brandId, strategyId, versionId, version.body.data.row_version);

    const sync = await fetch(`${brandBase}/seo/search-console/sync`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: '{}',
    });
    expect(sync.status).toBe(200);
    expect((await sync.json()).data).toMatchObject({ synced: true, source: 'GSC_FIXTURE' });
    const obs = await getPrisma().keywordRankObservation.findMany({
      where: { tenantId: seed.tenantId, brandId },
    });
    expect(obs.find((o) => o.keyword === 'عناية بالبشرة')?.locale).toBe('ar');
    expect(obs.find((o) => o.keyword === 'organic skincare')?.locale).toBe('en');

    // A snapshot from last week (position 18) → this week 14.2 = moved up 3.8.
    await getPrisma().keywordRankObservation.create({
      data: {
        id: newId(),
        tenantId: seed.tenantId,
        brandId,
        keyword: 'organic skincare',
        locale: 'en',
        position: 18,
        impressions: 600,
        clicks: 5,
        source: 'GSC_FIXTURE',
        capturedAt: new Date(Date.now() - 7 * 86_400_000),
      },
    });

    const tracking = await (
      await fetch(`${brandBase}/seo/rank-tracking?weeks=4`, { headers: authHeaders(seed) })
    ).json();
    expect(tracking.data.strategy_version_id).toBe(versionId);
    expect(tracking.data.weeks).toHaveLength(4);
    const organic = tracking.data.keywords.find(
      (k: { keyword: string }) => k.keyword === 'organic skincare',
    );
    expect(organic).toMatchObject({ latest_position: 14.2, change: 3.8, status: 'striking' });
    expect(organic.series.at(-2).position).toBe(18);
    const night = tracking.data.keywords.find(
      (k: { keyword: string }) => k.keyword === 'night cream',
    );
    expect(night).toMatchObject({ latest_position: null, status: 'not_ranking' });

    const gaps = await (
      await fetch(`${brandBase}/seo/gaps`, { headers: authHeaders(seed) })
    ).json();
    expect(
      gaps.data.gaps.map((g: { keyword: string; kind: string }) => [g.keyword, g.kind]),
    ).toEqual([
      ['organic skincare', 'striking_distance'],
      ['night cream', 'not_ranking'],
    ]);

    const bad = await fetch(`${brandBase}/seo/gaps/brief`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ keywords: ['brand name'] }),
    });
    expect(bad.status).toBe(409);
    const created = await fetch(`${brandBase}/seo/gaps/brief`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ keywords: ['organic skincare', 'night cream'] }),
    });
    expect(created.status).toBe(201);
    const { data } = await created.json();
    const brief = await getPrisma().brief.findFirst({ where: { id: data.brief_id } });
    expect(brief).toMatchObject({ origin: 'seo', status: 'DRAFT', strategyVersionId: versionId });
    const v = await getPrisma().briefVersion.findFirst({ where: { briefId: data.brief_id } });
    const content = JSON.parse(v!.contentJson);
    expect(content.deliverables).toHaveLength(2);
    expect(content.deliverables[0]).toMatchObject({
      key: 'seo-1',
      format: 'page_refresh',
      channel: 'Website',
    });
    expect(content.pillar_key).toBe('edu');
  });
});
