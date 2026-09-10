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

  it('draft OK without approved profile', async () => {
    const { body: brand } = await createBrand(seed);
    const { res, body } = await createStrategy(seed, brand.data.id, { name: 'No profile draft' });
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

  it('draft_aid profile is not enough for submit', async () => {
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
    expect([200, 201]).toContain(aid.res.status);
    rowVersion = aid.body.data.row_version;

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
