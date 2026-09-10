import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approveStrategy,
  createBrand,
  createStrategy,
  getStrategyVersion,
  patchFoundation,
  seedApprovedProfileVersion,
  seedBrandTenant,
  setTrackEnablement,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy package disabled track', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('organic-only requires paid_disabled_rationale; approve succeeds with rationale', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const profileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
    const { body: created } = await createStrategy(seed, brandId, {
      linked_approved_profile_version_id: profileId,
    });
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    let rowVersion = created.data.latest_version.row_version as number;

    const patched = await patchFoundation(seed, brandId, strategyId, versionId, rowVersion, {
      goals: [{ value: 'G', infoClass: 'USER_AUTHORED' }],
      positioning: { value: 'P', infoClass: 'USER_AUTHORED' },
    });
    rowVersion = patched.body.data.row_version;

    const withoutRationale = await setTrackEnablement(
      seed,
      brandId,
      strategyId,
      versionId,
      rowVersion,
      {
        organic_enabled: true,
        paid_enabled: false,
      },
    );
    // enablement may persist; submit must block without rationale
    if ([200, 201].includes(withoutRationale.res.status)) {
      rowVersion = withoutRationale.body.data.row_version;
      const blocked = await submitStrategy(seed, brandId, strategyId, versionId, rowVersion);
      expect(blocked.res.status).toBe(422);
      expect(JSON.stringify(blocked.body)).toMatch(/PAID_DISABLED_RATIONALE|APPROVAL_INELIGIBLE/i);
    }

    const after = await getStrategyVersion(seed, brandId, strategyId, versionId);
    rowVersion = after.body.data.row_version;
    const withRationale = await setTrackEnablement(
      seed,
      brandId,
      strategyId,
      versionId,
      rowVersion,
      {
        organic_enabled: true,
        paid_enabled: false,
        paid_disabled_rationale: 'Paid deferred this quarter',
      },
    );
    expect([200, 201]).toContain(withRationale.res.status);
    rowVersion = withRationale.body.data.row_version;

    const submitted = await submitStrategy(seed, brandId, strategyId, versionId, rowVersion);
    expect([200, 201]).toContain(submitted.res.status);
    const approved = await approveStrategy(
      seed,
      brandId,
      strategyId,
      versionId,
      submitted.body.data.row_version,
    );
    expect([200, 201]).toContain(approved.res.status);
    expect(approved.body.data.paid_disabled_rationale).toMatch(/deferred/i);
  });

  it('cannot approve package when disabled track lacks rationale', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const profileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
    const { body: created } = await createStrategy(seed, brandId, {
      name: 'No rationale',
      linked_approved_profile_version_id: profileId,
    });
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    let rowVersion = created.data.latest_version.row_version as number;
    await patchFoundation(seed, brandId, strategyId, versionId, rowVersion, {
      goals: [{ value: 'G', infoClass: 'USER_AUTHORED' }],
      positioning: { value: 'P', infoClass: 'USER_AUTHORED' },
    });
    const afterPatch = await getStrategyVersion(seed, brandId, strategyId, versionId);
    rowVersion = afterPatch.body.data.row_version;

    // Force paid disabled with empty rationale via direct update then try submit
    await setTrackEnablement(seed, brandId, strategyId, versionId, rowVersion, {
      organic_enabled: true,
      paid_enabled: false,
      paid_disabled_rationale: '',
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
