import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy submit profile gate (happy path)', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('after APPROVED profile + foundation + unknowns, submit → IN_REVIEW', async () => {
    const { body: brand } = await createBrand(seed);
    const ready = await seedReviewReadyStrategy(seed, brand.data.id);
    // seedReviewReadyStrategy links approved profile, foundation, disabled paid rationale
    const submitted = await submitStrategy(
      seed,
      brand.data.id,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    expect([200, 201]).toContain(submitted.res.status);
    expect(submitted.body.data.status).toBe('IN_REVIEW');
    expect(submitted.body.data.linked_approved_profile_version_id).toBe(ready.profileId);
  });
});
