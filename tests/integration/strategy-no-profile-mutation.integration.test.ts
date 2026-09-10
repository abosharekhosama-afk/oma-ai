import { afterAll, describe, expect, it } from 'vitest';
import { createBrand, createStrategy, getStrategy, seedApprovedProfileVersion, seedBrandTenant } from '../helpers/strategy-test';
import { getPrisma } from '@oma/db';

describe('strategy no profile mutation', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => { for (const c of closers) await c(); });
  it('does not mutate Feature 002 profile rows', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brandBody } = await createBrand(seed);
    const brandId = brandBody.data.id as string;
    const profileId = await seedApprovedProfileVersion(seed.tenantId, brandId);
    const before = await getPrisma().profileVersion.findUniqueOrThrow({ where: { id: profileId } });
    const { body: created } = await createStrategy(seed, brandId, { linked_approved_profile_version_id: profileId });
    await getStrategy(seed, brandId, created.data.id);
    const after = await getPrisma().profileVersion.findUniqueOrThrow({ where: { id: profileId } });
    expect(after.status).toBe(before.status);
    expect(after.sectionsJson).toBe(before.sectionsJson);
  });
});
