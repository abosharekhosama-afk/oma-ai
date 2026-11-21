import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
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

  it('create blocked without approved brand profile', async () => {
    const { body: brand } = await createBrand(seed);
    const { res, body } = await createStrategy(
      seed,
      brand.data.id,
      { name: 'No profile draft' },
      { allowWithoutBrandApprovedProfile: true },
    );
    expect([403, 400, 422]).toContain(res.status);
    expect(JSON.stringify(body)).toMatch(/APPROVED|اعتماد ملف|BRAND_PROFILE_NOT_APPROVED/i);
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

  it('rejects draft_aid profile links (approved profile only)', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const draftProfileId = newId();
    await getPrisma().profileVersion.create({
      data: {
        id: draftProfileId,
        tenantId: seed.tenantId,
        brandId,
        status: 'DRAFT',
        sectionsJson: JSON.stringify({ overview: { name: 'Draft aid' } }),
      },
    });
    await seedApprovedProfileVersion(seed.tenantId, brandId);
    const { body: created } = await createStrategy(seed, brandId, { name: 'Draft aid only' });
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    const rowVersion = created.data.latest_version.row_version as number;

    const aid = await linkApprovedProfile(
      seed,
      brandId,
      strategyId,
      versionId,
      draftProfileId,
      rowVersion,
      'draft_aid',
    );
    expect([403, 400, 422]).toContain(aid.res.status);
    expect(JSON.stringify(aid.body)).toMatch(/DRAFT_PROFILE|APPROVED|اعتماد/i);
  });
});
