import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  createBrand,
  createStrategy,
  getStrategyVersion,
  linkApprovedProfile,
  patchFoundation,
  seedApprovedProfileVersion,
  seedBrandTenant,
  setTrackEnablement,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy profile gate', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('creation is blocked until the brand profile is APPROVED', async () => {
    const { body: brand } = await createBrand(seed);
    const { res, body } = await createStrategy(
      seed,
      brand.data.id,
      { name: 'No profile draft' },
      { ensureApprovedProfile: false },
    );
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('BRAND_PROFILE_NOT_APPROVED');
    expect(body.error.details).toEqual([{ brand_id: brand.data.id, required_status: 'APPROVED' }]);
  });

  it('creation rejects a draft profile id', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const draftProfileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
    await getPrisma().profileVersion.update({
      where: { id: draftProfileId },
      data: { status: 'DRAFT', approvedAt: null },
    });
    const { res, body } = await createStrategy(seed, brandId, {
      name: 'Draft aid on create',
      draft_profile_version_id: draftProfileId,
    });
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('DRAFT_PROFILE_FORBIDDEN');
  });

  it('approved profile allows a draft that is flagged missing_source until linked', async () => {
    const { body: brand } = await createBrand(seed);
    const { res, body } = await createStrategy(seed, brand.data.id, { name: 'Unlinked draft' });
    expect([200, 201]).toContain(res.status);
    expect(body.data.latest_version.missing_source).toBe(true);
    expect(body.data.latest_version.status).toBe('DRAFT');
  });

  it('submit blocked without approved profile link', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const { body: created } = await createStrategy(seed, brandId);
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    let rowVersion = created.data.latest_version.row_version as number;
    await patchFoundation(seed, brandId, strategyId, versionId, rowVersion, {
      goals: [{ value: 'G', infoClass: 'USER_AUTHORED' }],
      positioning: { value: 'P', infoClass: 'USER_AUTHORED' },
    });
    const after = await getStrategyVersion(seed, brandId, strategyId, versionId);
    rowVersion = after.body.data.row_version;
    await setTrackEnablement(seed, brandId, strategyId, versionId, rowVersion, {
      organic_enabled: true,
      paid_enabled: false,
      paid_disabled_rationale: 'Later',
    });
    const afterEnable = await getStrategyVersion(seed, brandId, strategyId, versionId);
    const blocked = await submitStrategy(
      seed,
      brandId,
      strategyId,
      versionId,
      afterEnable.body.data.row_version,
    );
    expect(blocked.res.status).toBe(422);
    expect(JSON.stringify(blocked.body)).toMatch(/APPROVED_PROFILE_REQUIRED|APPROVAL_INELIGIBLE/);
  });

  it('draft profile cannot be linked as draft_aid and submit stays blocked', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const draftProfileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
    await getPrisma().profileVersion.update({
      where: { id: draftProfileId },
      data: { status: 'DRAFT', approvedAt: null },
    });
    const { body: created } = await createStrategy(seed, brandId, { name: 'Draft aid only' });
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    let rowVersion = created.data.latest_version.row_version as number;

    const aid = await linkApprovedProfile(
      seed,
      brandId,
      strategyId,
      versionId,
      draftProfileId,
      rowVersion,
      'draft_aid',
    );
    expect(aid.res.status).toBe(403);
    expect(aid.body.error.code).toBe('DRAFT_PROFILE_FORBIDDEN');

    await patchFoundation(seed, brandId, strategyId, versionId, rowVersion, {
      goals: [{ value: 'G', infoClass: 'USER_AUTHORED' }],
      positioning: { value: 'P', infoClass: 'USER_AUTHORED' },
    });
    const afterPatch = await getStrategyVersion(seed, brandId, strategyId, versionId);
    rowVersion = afterPatch.body.data.row_version;
    await setTrackEnablement(seed, brandId, strategyId, versionId, rowVersion, {
      organic_enabled: true,
      paid_enabled: false,
      paid_disabled_rationale: 'Later',
    });
    const afterEnable = await getStrategyVersion(seed, brandId, strategyId, versionId);
    const blocked = await submitStrategy(
      seed,
      brandId,
      strategyId,
      versionId,
      afterEnable.body.data.row_version,
    );
    expect(blocked.res.status).toBe(422);
  });
});
