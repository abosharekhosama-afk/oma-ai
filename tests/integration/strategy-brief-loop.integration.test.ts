import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createBrand } from '../helpers/brand-test';
import {
  authHeaders,
  bringToApproved,
  getStrategyVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

/** DEC-029 4.3: plan → brief → tasks, with execution status per pillar. */
describe('strategy brief loop', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a brief per pillar with one deliverable per slot; tasks only via brief convert', async () => {
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
          { key: 'edu', name_en: 'Education', name_ar: 'تثقيف', share_target_pct: 60 },
          { key: 'offer', name_en: 'Offers', name_ar: 'عروض', share_target_pct: 40 },
        ],
        cadence: [{ channel: 'Instagram', posts_per_week: 5, formats: ['Reel'] }],
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
    expect(commit.data.created_request_ids).toHaveLength(2);
    expect(commit.data.created_brief_ids).toHaveLength(2);

    const briefsRoot = `${seed.baseUrl}/api/v1/brands/${brandId}/briefs`;
    const briefs = await Promise.all(
      (commit.data.created_brief_ids as string[]).map(async (id) =>
        (
          await fetch(`${briefsRoot}/${id}`, { headers: { cookie: authHeaders(seed).cookie } })
        ).json(),
      ),
    );
    const edu = briefs.find((b) => b.data.current_version.content.pillar_key === 'edu')!;
    expect(edu.data.origin).toBe('strategy');
    expect(edu.data.current_version.content.deliverables).toHaveLength(3);
    expect(edu.data.current_version.content.deliverables[0]).toMatchObject({
      key: 'slot-1',
      channel: 'Instagram',
      format: 'Reel',
    });

    const replay = await (
      await fetch(`${base}/plan-to-requests/commit`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ calendar: { start_date: '2026-12-07', weeks: 1 } }),
      })
    ).json();
    expect(replay.data.created_brief_ids).toEqual([]);

    const bypass = await (
      await fetch(`${base}/plan-to-requests/convert-tasks`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: '{}',
      })
    ).json();
    expect(bypass.data.created_task_ids).toEqual([]);

    const act = async (id: string, action: string, rv: number) => {
      const res = await fetch(`${briefsRoot}/${id}/${action}`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ row_version: rv }),
      });
      return { status: res.status, body: await res.json() };
    };
    const submitted = await act(edu.data.id, 'submit', edu.data.row_version);
    expect([200, 201]).toContain(submitted.status);
    const approved = await act(edu.data.id, 'approve', submitted.body.data.row_version);
    expect(approved.body.data.status).toBe('APPROVED');
    const converted = await act(edu.data.id, 'convert', approved.body.data.row_version);
    expect(converted.body.data.created_task_count).toBe(3);

    const exec = await (await fetch(`${base}/execution`, { headers: authHeaders(seed) })).json();
    const eduRow = exec.data.pillars.find((p: { key: string }) => p.key === 'edu');
    expect(eduRow).toMatchObject({
      requests: 1,
      share_target_pct: 60,
      planned_share_pct: 60,
      tasks: { open: 3, done: 0 },
      briefs: { CONVERTED: 1 },
    });
    expect(eduRow.content.planned).toBe(3);
    expect(exec.data.totals).toMatchObject({
      requests: 2,
      briefs: 2,
      briefs_approved: 1,
      content_planned: 5,
    });
  });
});
