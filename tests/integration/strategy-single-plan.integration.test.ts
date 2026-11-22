import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import { createBrand } from '../helpers/brand-test';
import {
  authHeaders,
  bringToApproved,
  createStrategy,
  getStrategyVersion,
  seedApprovedProfileVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

/** DEC-029 4.1: tracks v2 is the single organic plan model (pillars + cadence). */
describe('strategy single plan model (v2 pillars + cadence)', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  function planUrl(brandId: string, strategyId: string, versionId: string) {
    return `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan`;
  }

  async function putOrganic(url: string, body: Record<string, unknown>) {
    const res = await fetch(`${url}/organic`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify(body),
    });
    return { res, body: await res.json() };
  }

  it('stores cadence, keeps it when omitted, and drives plan→requests from v2', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { strategyId, versionId, rowVersion } = await seedReviewReadyStrategy(seed, brandId);
    const url = planUrl(brandId, strategyId, versionId);

    const pillars = [
      { key: 'education', name_en: 'Education', name_ar: 'تثقيف', share_target_pct: 60 },
      { key: 'proof', name_en: 'Social proof', name_ar: 'إثبات اجتماعي', share_target_pct: 40 },
    ];
    const dup = await putOrganic(url, {
      row_version: rowVersion,
      pillars,
      cadence: [
        { channel: 'Instagram', posts_per_week: 3 },
        { channel: 'instagram', posts_per_week: 1 },
      ],
    });
    expect(dup.res.status).toBe(400);

    const saved = await putOrganic(url, {
      row_version: rowVersion,
      pillars,
      cadence: [
        { channel: 'Instagram', posts_per_week: 3, formats: ['Reel', 'Carousel'] },
        { channel: 'TikTok', posts_per_week: 2, formats: ['Video'] },
        { channel: 'Blog', posts_per_week: 0 },
      ],
    });
    expect(saved.res.status).toBe(200);
    expect(saved.body.data.organic.cadence).toHaveLength(3);
    expect(saved.body.data.organic.cadence[0]).toMatchObject({
      channel: 'Instagram',
      posts_per_week: 3,
      formats: ['Reel', 'Carousel'],
      source: 'MANUAL',
    });

    // Older clients / AI proposals omit cadence: stored cadence must survive.
    const kept = await putOrganic(url, {
      row_version: saved.body.data.row_version,
      pillars,
    });
    expect(kept.res.status).toBe(200);
    expect(kept.body.data.organic.cadence).toHaveLength(3);

    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    await bringToApproved(seed, brandId, strategyId, versionId, version.body.data.row_version);

    const previewRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan-to-requests/preview`,
      { headers: authHeaders(seed) },
    );
    expect(previewRes.status).toBe(200);
    const preview = await previewRes.json();
    const organic = (
      preview.data.preview as Array<{
        plan_source_key: string;
        channels: string[];
        formats: string[];
        title: { en: string; ar: string };
      }>
    ).filter((d) => d.plan_source_key.startsWith('organic:pillar:'));
    expect(organic.map((d) => d.plan_source_key)).toEqual([
      'organic:pillar:education',
      'organic:pillar:proof',
    ]);
    // Channels with 0 posts/week are not scheduled.
    expect(organic[0]!.channels).toEqual(['Instagram', 'TikTok']);
    expect(organic[0]!.formats).toEqual(['Reel', 'Carousel', 'Video']);
    expect(organic[1]!.title.ar).toContain('إثبات اجتماعي');
  });

  it('foundation AI accept fills empty v2 pillars and cadence instead of legacy JSON', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    await seedApprovedProfileVersion(seed.tenantId, brandId);
    const { body: created } = await createStrategy(seed, brandId, {
      organic_enabled: true,
      paid_enabled: false,
    });
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;

    const prev = {
      adapter: process.env.AI_TEST_ADAPTER,
      live: process.env.AI_LIVE_ENABLED,
      mode: process.env.STRATEGY_AI_MODE,
    };
    process.env.AI_TEST_ADAPTER = '1';
    process.env.AI_LIVE_ENABLED = 'false';
    process.env.STRATEGY_AI_MODE = 'live';
    try {
      const base = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`;
      const proposed = await fetch(`${base}/ai/propose`, {
        method: 'POST',
        headers: { ...authHeaders(seed), 'Idempotency-Key': `strat-${newId()}` },
        body: '{}',
      });
      expect([200, 201]).toContain(proposed.status);
      const proposedBody = await proposed.json();
      const accepted = await fetch(`${base}/ai/propose/accept`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ run_id: proposedBody.data.run_id }),
      });
      expect([200, 201]).toContain(accepted.status);
    } finally {
      process.env.AI_TEST_ADAPTER = prev.adapter;
      process.env.AI_LIVE_ENABLED = prev.live;
      process.env.STRATEGY_AI_MODE = prev.mode;
    }

    const planRes = await fetch(planUrl(brandId, strategyId, versionId), {
      headers: { cookie: authHeaders(seed).cookie },
    });
    const plan = await planRes.json();
    expect(plan.data.organic.pillars.length).toBeGreaterThan(0);
    expect(plan.data.organic.pillars[0]).toMatchObject({
      info_class: 'AI_PROPOSAL',
      source: 'AI_ESTIMATE',
    });
    expect(plan.data.organic.cadence).toEqual([
      expect.objectContaining({ channel: 'instagram', posts_per_week: 3 }),
    ]);

    const legacy = await getPrisma().strategyOrganicTrack.findUnique({
      where: { strategyVersionId: versionId },
    });
    expect(legacy?.pillarsJson ?? '[]').toBe('[]');
  });
});
