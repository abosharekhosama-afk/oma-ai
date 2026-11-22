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

/** DEC-029 4.2: approved plan → dated calendar slots by cadence and pillar share. */
describe('strategy → calendar', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('spreads pillar work over cadence slots with staggered due dates', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { strategyId, versionId, rowVersion } = await seedReviewReadyStrategy(seed, brandId);
    const base = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}`;

    const put = await fetch(`${base}/plan/organic`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: rowVersion,
        pillars: [
          { key: 'edu', name_en: 'Education', name_ar: 'تثقيف', share_target_pct: 50 },
          { key: 'offer', name_en: 'Offers', name_ar: 'عروض', share_target_pct: 50 },
        ],
        cadence: [{ channel: 'Instagram', posts_per_week: 3, formats: ['Reel'] }],
      }),
    });
    expect(put.status).toBe(200);
    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    await bringToApproved(seed, brandId, strategyId, versionId, version.body.data.row_version);

    const preview = await (
      await fetch(`${base}/plan-to-requests/preview`, { headers: authHeaders(seed) })
    ).json();
    expect(preview.data.calendar).toMatchObject({
      available: true,
      posts_per_week: 3,
      default_weeks: 4,
      slots_in_default: 12,
      by_pillar: { edu: 6, offer: 6 },
    });

    const bad = await fetch(`${base}/plan-to-requests/commit`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ calendar: { start_date: '2026-12-07', weeks: 13 } }),
    });
    expect(bad.status).toBe(400);

    const commitRes = await fetch(`${base}/plan-to-requests/commit`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ calendar: { start_date: '2026-12-07', weeks: 2 } }),
    });
    expect([200, 201]).toContain(commitRes.status);
    const commit = await commitRes.json();
    expect(commit.data.calendar).toMatchObject({
      start_date: '2026-12-07',
      weeks: 2,
      planned_slots: 6,
      slots_created: 6,
      truncated: false,
    });
    expect(commit.data.created_request_ids).toHaveLength(2);
    expect(commit.data.created_content_ids).toHaveLength(6);

    const requests = await getPrisma().workRequest.findMany({
      where: { tenantId: seed.tenantId, strategyVersionId: versionId },
      orderBy: { dueAt: 'asc' },
    });
    const dues = requests.map((r) => r.dueAt?.toISOString());
    // No single shared due date: each pillar is due before its first slot.
    expect(new Set(dues).size).toBe(2);

    const contents = await getPrisma().contentItem.findMany({
      where: { tenantId: seed.tenantId, id: { in: commit.data.created_content_ids } },
      orderBy: { plannedAt: 'asc' },
    });
    expect(contents.every((c) => c.plannedAt && c.status === 'DRAFT')).toBe(true);
    expect(new Set(contents.map((c) => c.plannedAt!.toISOString().slice(0, 10))).size).toBe(6);
    expect(contents.filter((c) => c.labels.includes('organic:pillar:edu'))).toHaveLength(3);
    expect(contents.filter((c) => c.labels.includes('organic:pillar:offer'))).toHaveLength(3);

    const repeat = await (
      await fetch(`${base}/plan-to-requests/commit`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ calendar: { start_date: '2026-12-07', weeks: 2 } }),
      })
    ).json();
    expect(repeat.data.created_content_ids).toEqual([]);
  });
});
