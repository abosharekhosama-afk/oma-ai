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

/** DEC-029 4.10: monthly review → measured findings → new DRAFT + AI proposal (never auto-applied). */
describe('strategy monthly review', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('computes findings, creates one draft per version+month, refuses with an open draft', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { strategyId, versionId, rowVersion } = await seedReviewReadyStrategy(seed, brandId);
    const sbase = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}`;
    const base = `${sbase}/versions/${versionId}`;
    const post = (path: string, body: unknown) =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify(body),
      });

    const put = await fetch(`${base}/plan/organic`, {
      method: 'PUT',
      headers: authHeaders(seed),
      body: JSON.stringify({
        row_version: rowVersion,
        pillars: [{ key: 'edu', name_en: 'Education', name_ar: 'تثقيف', share_target_pct: 100 }],
        cadence: [{ channel: 'Instagram', posts_per_week: 3 }],
      }),
    });
    expect(put.status).toBe(200);

    // Not approved yet → monthly review refuses.
    expect(
      (await fetch(`${base}/monthly-review?month=2026-10`, { headers: authHeaders(seed) })).status,
    ).toBe(409);

    const version = await getStrategyVersion(seed, brandId, strategyId, versionId);
    await bringToApproved(seed, brandId, strategyId, versionId, version.body.data.row_version);
    const commit = await (
      await post('/plan-to-requests/commit', { calendar: { start_date: '2026-10-05', weeks: 1 } })
    ).json();
    const ids = commit.data.created_content_ids as string[];
    expect(ids.length).toBe(3);
    await getPrisma().contentItem.update({
      where: { id: ids[0]! },
      data: { publishedAt: new Date('2026-10-06T10:00:00Z') },
    });

    expect(
      (await fetch(`${base}/monthly-review?month=2099-01`, { headers: authHeaders(seed) })).status,
    ).toBe(400);
    const preview = await (
      await fetch(`${base}/monthly-review?month=2026-10`, { headers: authHeaders(seed) })
    ).json();
    const shortfall = (preview.data.findings as Array<Record<string, unknown>>).find(
      (f) => f.code === 'CADENCE_SHORTFALL',
    );
    expect(shortfall).toMatchObject({
      subject: 'Instagram',
      severity: 'warn',
      facts: { expected: 13, published: 1, delivery_pct: 8 },
    });
    expect(preview.data.actionable).toBeGreaterThan(0);
    expect(preview.data.review).toBeNull();

    const run = await post('/monthly-review', { month: '2026-10' });
    expect(run.status).toBe(201);
    const ran = await run.json();
    expect(ran.data.replayed).toBe(false);
    expect(['PROPOSED', 'DRAFT_ONLY']).toContain(ran.data.review.status);
    const draftId = ran.data.review.draft_version_id as string;
    expect(draftId).toBeTruthy();
    const draft = await getPrisma().strategyVersion.findUniqueOrThrow({ where: { id: draftId } });
    expect(draft.status).toBe('DRAFT');
    expect(draft.versionNumber).toBe(2);
    // The proposal is never auto-applied: the draft plan is still the approved copy.
    const draftPlan = await (
      await fetch(`${sbase}/versions/${draftId}/plan`, { headers: authHeaders(seed) })
    ).json();
    expect(JSON.stringify(draftPlan.data)).toContain('Instagram');
    if (ran.data.review.status === 'PROPOSED') {
      expect(ran.data.review.ai_run_id).toBeTruthy();
      const aiRun = await getPrisma().aiRun.findUniqueOrThrow({
        where: { id: ran.data.review.ai_run_id },
      });
      expect(aiRun.sourceEntityId).toBe(draftId);
      expect(aiRun.metadataJson).toContain('monthly_review');
    }

    // Idempotent per version + month.
    const again = await (await post('/monthly-review', { month: '2026-10' })).json();
    expect(again.data.replayed).toBe(true);
    expect(again.data.review.id).toBe(ran.data.review.id);

    // Another month while the draft is open → 409 with the open draft id.
    const blocked = await post('/monthly-review', { month: '2026-09' });
    expect(blocked.status).toBe(409);
    expect(JSON.stringify(await blocked.json())).toContain(draftId);

    const list = await (
      await fetch(`${sbase}/monthly-reviews`, { headers: authHeaders(seed) })
    ).json();
    expect(list.data).toHaveLength(1);
    expect(list.data[0].month).toBe('2026-10');
    const audit = await getPrisma().auditEvent.findFirst({
      where: { tenantId: seed.tenantId, action: 'strategy.monthly_review.created' },
    });
    expect(audit?.beforeRef).toBe('2026-10');
  });
});
