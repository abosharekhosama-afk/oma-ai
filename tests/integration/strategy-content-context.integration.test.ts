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

/** DEC-029 4.4: plan content carries pillar + keyword; content AI is grounded in it. */
describe('strategy context on content', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('stamps strategy version, pillar and rotating keywords; AI reports the context', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { strategyId, versionId, rowVersion } = await seedReviewReadyStrategy(seed, brandId);
    const base = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`;
    const put = await fetch(`${base}/plan/organic`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: rowVersion,
        pillars: [{ key: 'edu', name_en: 'Education', name_ar: 'تثقيف', share_target_pct: 100 }],
        cadence: [{ channel: 'Instagram', posts_per_week: 3 }],
        seo_keywords: [
          { keyword: 'night cream', intent: 'COMMERCIAL', pillar_key: 'edu', priority: 1 },
          { keyword: 'skin routine', intent: 'INFORMATIONAL', pillar_key: 'edu', priority: 2 },
        ],
      }),
    });
    expect(put.status).toBe(200);
    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    await bringToApproved(seed, brandId, strategyId, versionId, version.body.data.row_version);

    const commit = await (
      await fetch(`${base}/plan-to-requests/commit`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ calendar: { start_date: '2026-12-07', weeks: 1 } }),
      })
    ).json();
    const contents = await getPrisma().contentItem.findMany({
      where: { tenantId: seed.tenantId, id: { in: commit.data.created_content_ids } },
      orderBy: { plannedAt: 'asc' },
    });
    expect(contents).toHaveLength(3);
    expect(contents.every((c) => c.strategyVersionId === versionId && c.pillarKey === 'edu')).toBe(
      true,
    );
    expect(contents.map((c) => c.targetKeyword)).toEqual([
      'night cream',
      'skin routine',
      'night cream',
    ]);

    const detail = await (
      await fetch(`${seed.baseUrl}/api/v1/content/${contents[0]!.id}`, {
        headers: { cookie: authHeaders(seed).cookie },
      })
    ).json();
    expect(detail.data).toMatchObject({
      strategy_version_id: versionId,
      pillar_key: 'edu',
      target_keyword: 'night cream',
    });

    const prev = { adapter: process.env.AI_TEST_ADAPTER, live: process.env.AI_LIVE_ENABLED };
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    try {
      const gen = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/ai/generate`, {
        method: 'POST',
        headers: { ...authHeaders(seed), 'Idempotency-Key': `gen-${newId()}` },
        body: JSON.stringify({
          kind: 'caption',
          channel: 'instagram',
          language: 'en',
          content_id: contents[0]!.id,
        }),
      });
      const genBody = await gen.json();
      expect([200, 201]).toContain(gen.status);
      expect(genBody.data.strategy_context).toMatchObject({
        strategy_version_id: versionId,
        pillar_key: 'edu',
        pillar_name: 'Education',
        target_keyword: 'night cream',
      });
      const run = await getPrisma().aiRun.findFirst({ where: { id: genBody.data.run_id } });
      expect(run?.metadataJson ?? '').toContain('"pillarKey":"edu"');
    } finally {
      process.env.AI_TEST_ADAPTER = prev.adapter;
      process.env.AI_LIVE_ENABLED = prev.live;
    }
  });
});
