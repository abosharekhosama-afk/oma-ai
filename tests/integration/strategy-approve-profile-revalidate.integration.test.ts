import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  approveStrategy,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy approve profile revalidate', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('blocks approve when linked profile is no longer APPROVED', async () => {
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
    expect([200, 201]).toContain(submitted.res.status);

    await getPrisma().profileVersion.update({
      where: { id: ready.profileId },
      data: { status: 'DRAFT', approvedAt: null },
    });

    const blocked = await approveStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      submitted.body.data.row_version,
    );
    expect(blocked.res.status).toBe(422);
    expect(JSON.stringify(blocked.body)).toMatch(/LINKED_PROFILE_NOT_APPROVED|APPROVAL_INELIGIBLE/);
  });
});
