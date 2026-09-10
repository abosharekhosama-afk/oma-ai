import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bringToApproved,
  createBrand,
  linkApprovedProfile,
  patchFoundation,
  seedApprovedProfileVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy profile link immutability', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('after submit cannot change linked profile', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const submitted = await submitStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    const otherProfile = await seedApprovedProfileVersion(seed.tenantId, brandId);
    const blocked = await linkApprovedProfile(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      otherProfile,
      submitted.body.data.row_version,
      'approved',
    );
    expect(blocked.res.status).toBe(409);
    expect(blocked.body.error?.code).toBe('CONFLICT_STATE');
  });

  it('approved version is immutable on PATCH foundation', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const { approved } = await bringToApproved(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    const patched = await patchFoundation(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      approved.body.data.row_version,
      { goals: [{ value: 'Mutate', infoClass: 'USER_AUTHORED' }] },
    );
    expect(patched.res.status).toBe(409);
    expect(patched.body.error?.code).toBe('CONFLICT_STATE');
  });
});
