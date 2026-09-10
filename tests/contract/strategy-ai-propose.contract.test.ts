import { afterAll, describe, expect, it } from 'vitest';
import {
  approveStrategy,
  authHeaders,
  createBrand,
  createStrategy,
  getStrategy,
  getStrategyVersion,
  linkApprovedProfile,
  patchFoundation,
  seedApprovedProfileVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
  setCurrentStrategy,
  submitStrategy,
} from '../helpers/strategy-test';
import { getPrisma } from '@oma/db';

describe('strategy workspace integration', () => {
  const closers: Array<() => Promise<void>> = [];

  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('creates draft without approved profile with missing_source warning', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;

    const { res, body } = await createStrategy(seed, brandId, { name: 'Draft only' });
    expect([200, 201]).toContain(res.status);
    expect(body.data.latest_version.missing_source).toBe(true);
    expect(body.data.latest_version.evidence_backed).toBe(false);
  });

  it('package approve does not set current; set_current is explicit; archive clears pointer', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;

    const ready = await seedReviewReadyStrategy(seed, brandId);
    const submitted = await submitStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    expect([200, 201]).toContain(submitted.res.status);
    expect(submitted.body.data.status).toBe('IN_REVIEW');

    const approved = await approveStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      submitted.body.data.row_version,
    );
    expect([200, 201]).toContain(approved.res.status);
    expect(approved.body.data.status).toBe('APPROVED');

    const brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brand.currentApprovedStrategyId).toBeNull();

    const set = await setCurrentStrategy(seed, brandId, ready.strategyId, brand.version);
    expect([200, 201]).toContain(set.res.status);
    expect(set.body.data.strategy.id).toBe(ready.strategyId);

    const strategy = await getPrisma().strategy.findUniqueOrThrow({
      where: { id: ready.strategyId },
    });
    const archived = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${ready.strategyId}/archive`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ version: strategy.version }),
      },
    );
    expect([200, 201]).toContain(archived.status);
    const brandAfter = await getPrisma().brandWorkspace.findUniqueOrThrow({
      where: { id: brandId },
    });
    expect(brandAfter.currentApprovedStrategyId).toBeNull();
  });

  it('draft_aid profile never satisfies submit gate; approved link does', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const draftProfileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
    await getPrisma().profileVersion.update({
      where: { id: draftProfileId },
      data: { status: 'DRAFT', approvedAt: null },
    });
    const approvedId = await seedApprovedProfileVersion(seed.tenantId, brandId);

    const { body: created } = await createStrategy(seed, brandId, { name: 'Gate test' });
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

    await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/tracks/enablement`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: rowVersion,
          organic_enabled: true,
          paid_enabled: false,
          paid_disabled_rationale: 'Later',
        }),
      },
    );
    const afterEnable = await getStrategyVersion(seed, brandId, strategyId, versionId);
    rowVersion = afterEnable.body.data.row_version;

    const blocked = await submitStrategy(seed, brandId, strategyId, versionId, rowVersion);
    expect(blocked.res.status).toBe(422);

    const linked = await linkApprovedProfile(
      seed,
      brandId,
      strategyId,
      versionId,
      approvedId,
      rowVersion,
      'approved',
    );
    rowVersion = linked.body.data.row_version;
    const ok = await submitStrategy(seed, brandId, strategyId, versionId, rowVersion);
    expect([200, 201]).toContain(ok.res.status);
    expect(ok.body.data.status).toBe('IN_REVIEW');
  });

  it('ai propose refuses without fabricating content', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const { body: created } = await createStrategy(seed, brandId);
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/ai/propose`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: '{}',
      },
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(['AI_NOT_CONFIGURED', 'AI_REFUSED', 'AI_UNAVAILABLE']).toContain(body.error.code);
  });

  it('does not mutate Feature 002 profile rows on strategy commands', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const profileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
    const before = await getPrisma().profileVersion.findUniqueOrThrow({ where: { id: profileId } });
    const { body: created } = await createStrategy(seed, brandId, {
      linked_approved_profile_version_id: profileId,
    });
    await getStrategy(seed, brandId, created.data.id);
    const after = await getPrisma().profileVersion.findUniqueOrThrow({ where: { id: profileId } });
    expect(after.status).toBe(before.status);
    expect(after.sectionsJson).toBe(before.sectionsJson);
    expect(after.approvedAt?.getTime()).toBe(before.approvedAt?.getTime());
  });
});
