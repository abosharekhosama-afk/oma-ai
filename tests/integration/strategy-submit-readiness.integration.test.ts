import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  authHeaders,
  createBrand,
  getStrategyVersion,
  patchFoundation,
  seedApprovedProfileVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

/**
 * Regression for "I tick the assumptions box, press Send for review and only see
 * 'This item can't be approved yet'": the gate needs goals + positioning, the AI
 * proposal may leave positioning empty (it is allowed to return null), and the UI
 * never said what was missing. Readiness and the 422 now name each missing item.
 */
describe('strategy submit readiness', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  const readinessUrl = (brandId: string, strategyId: string, versionId: string) =>
    `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/readiness`;

  async function readiness(brandId: string, strategyId: string, versionId: string) {
    const res = await fetch(readinessUrl(brandId, strategyId, versionId), {
      headers: { cookie: authHeaders(seed).cookie },
    });
    return { res, body: await res.json() };
  }

  async function submit(
    brandId: string,
    strategyId: string,
    versionId: string,
    rowVersion: number,
  ) {
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/submit`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ row_version: rowVersion, unknowns_acknowledged: true }),
      },
    );
    return { res, body: await res.json() };
  }

  it('names the missing positioning (with a fix link) instead of a generic refusal', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);

    // Same shape an accepted AI proposal leaves when it returns positioning: null.
    const patched = await patchFoundation(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
      {
        goals: [{ value: 'Grow awareness', infoClass: 'AI_PROPOSED' }],
        positioning: { value: '', infoClass: 'USER_AUTHORED' },
        keyMessages: [{ value: 'Soft fabrics', infoClass: 'AI_PROPOSED' }],
      },
    );
    let rowVersion = patched.body.data.row_version as number;

    const before = await readiness(brandId, ready.strategyId, ready.versionId);
    expect(before.res.status).toBe(200);
    expect(before.body.data.action).toBe('submit');
    expect(before.body.data.eligible).toBe(false);
    const codes = before.body.data.blocking_reasons.map((r: { code: string }) => r.code);
    expect(codes).toContain('FOUNDATION_POSITIONING_REQUIRED');
    expect(codes).not.toContain('FOUNDATION_GOALS_REQUIRED');
    expect(codes).not.toContain('REQUIRED_FOUNDATION_FIELDS');
    expect(before.body.data.blocking_reasons).toContainEqual({
      code: 'FOUNDATION_POSITIONING_REQUIRED',
      section: 'foundation',
      fix_path: '/edit#strategy-positioning',
    });
    expect(before.body.data.journey.current).toBe('foundation');

    const blocked = await submit(brandId, ready.strategyId, ready.versionId, rowVersion);
    expect(blocked.res.status).toBe(422);
    expect(blocked.body.error.code).toBe('APPROVAL_INELIGIBLE');
    expect(blocked.body.error.message_key).toBe('errors.strategy_submit_blocked');
    expect(blocked.body.error.details).toEqual([
      {
        code: 'FOUNDATION_POSITIONING_REQUIRED',
        section: 'foundation',
        fix_path: '/edit#strategy-positioning',
      },
    ]);

    const fixed = await patchFoundation(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      rowVersion,
      {
        goals: [{ value: 'Grow awareness', infoClass: 'AI_PROPOSED' }],
        positioning: { value: 'The comfortable everyday brand', infoClass: 'USER_AUTHORED' },
      },
    );
    rowVersion = fixed.body.data.row_version as number;

    const after = await readiness(brandId, ready.strategyId, ready.versionId);
    // Only the assumptions box remains; the submit body satisfies it.
    expect(after.body.data.blocking_reasons.map((r: { code: string }) => r.code)).toEqual([
      'UNKNOWNS_ACK_REQUIRED',
    ]);

    const ok = await submit(brandId, ready.strategyId, ready.versionId, rowVersion);
    expect([200, 201]).toContain(ok.res.status);
    expect(ok.body.data.status).toBe('IN_REVIEW');

    const inReview = await readiness(brandId, ready.strategyId, ready.versionId);
    expect(inReview.body.data.action).toBe('approve');
    expect(inReview.body.data.eligible).toBe(true);
    expect(inReview.body.data.journey.current).toBe('approve');
  });

  it('flags a link to a replaced brand profile with a fix link to the evidence panel', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await getPrisma().profileVersion.update({
      where: { id: ready.profileId },
      data: { status: 'SUPERSEDED' },
    });
    await seedApprovedProfileVersion(seed.tenantId, brandId);

    const r = await readiness(brandId, ready.strategyId, ready.versionId);
    expect(r.body.data.blocking_reasons).toContainEqual({
      code: 'LINKED_PROFILE_NOT_APPROVED',
      section: 'evidence',
      fix_path: '/review#strategy-link-profile',
    });
    const v = await getStrategyVersion(seed, brandId, ready.strategyId, ready.versionId);
    const blocked = await submit(
      brandId,
      ready.strategyId,
      ready.versionId,
      v.body.data.row_version,
    );
    expect(blocked.res.status).toBe(422);
    expect(JSON.stringify(blocked.body.error.details)).toContain('LINKED_PROFILE_NOT_APPROVED');
  });

  it('readiness is read-only (row_version unchanged)', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await readiness(brandId, ready.strategyId, ready.versionId);
    const v = await getStrategyVersion(seed, brandId, ready.strategyId, ready.versionId);
    expect(v.body.data.row_version).toBe(ready.rowVersion);
    expect(v.body.data.status).toBe('DRAFT');
  });
});
