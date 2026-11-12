import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import type { INestApplication } from '@nestjs/common';
import { createBrand } from '../helpers/brand-test';
import {
  authHeaders,
  bringToApproved,
  getStrategyVersion,
  linkApprovedProfile,
  seedReviewReadyStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy plan → work requests', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('preview and commit idempotent work requests from approved strategy', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { strategyId, versionId, profileId, rowVersion } = await seedReviewReadyStrategy(
      seed,
      brandId,
    );

    await linkApprovedProfile(
      seed,
      brandId,
      strategyId,
      versionId,
      profileId,
      rowVersion,
      'approved',
    );
    const linked = await getStrategyVersion(seed, brandId, strategyId, versionId);
    let rv = linked.body.data.row_version as number;

    const organicRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/organic`,
      {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: rv,
          pillars: ['Education content', 'Community stories'],
          channels: ['Instagram'],
          formats: ['Reel'],
        }),
      },
    );
    expect(organicRes.status).toBe(200);
    const organicBody = await organicRes.json();
    rv = organicBody.data.row_version as number;

    await bringToApproved(seed, brandId, strategyId, versionId, rv);

    const previewRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan-to-requests/preview`,
      { method: 'POST', headers: authHeaders(seed), body: '{}' },
    );
    expect(previewRes.status).toBe(200);
    const preview = await previewRes.json();
    expect(preview.data.preview.length).toBeGreaterThanOrEqual(2);

    const commitRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan-to-requests/commit`,
      { method: 'POST', headers: authHeaders(seed), body: JSON.stringify({}) },
    );
    expect(commitRes.status).toBe(200);
    const commit = await commitRes.json();
    expect(commit.data.created_request_ids.length).toBeGreaterThanOrEqual(2);

    const repeat = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan-to-requests/commit`,
      { method: 'POST', headers: authHeaders(seed), body: JSON.stringify({}) },
    );
    const repeatBody = await repeat.json();
    expect(repeatBody.data.created_request_ids).toEqual([]);
    expect(repeatBody.data.skipped_plan_source_keys.length).toBeGreaterThan(0);

    const rows = await getPrisma().workRequest.findMany({
      where: { tenantId: seed.tenantId, strategyVersionId: versionId },
    });
    expect(rows.every((r) => r.briefObjectiveEn.length > 0)).toBe(true);
    expect(rows.every((r) => r.planSourceKey)).toBe(true);
  });
});
