import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  bringToApproved,
  createBrand,
  reviseStrategy,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

describe('strategy revise', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('revise approved → new DRAFT version without approval inheritance', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);

    const revised = await reviseStrategy(seed, brandId, ready.strategyId, ready.versionId);
    expect([200, 201]).toContain(revised.res.status);
    expect(revised.body.data.status).toBe('DRAFT');
    expect(revised.body.data.version_number).toBeGreaterThan(1);
    expect(revised.body.data.id).not.toBe(ready.versionId);

    const approval = await getPrisma().strategyApprovalRecord.findUnique({
      where: { strategyVersionId: revised.body.data.id },
    });
    expect(approval).toBeNull();

    const prior = await getPrisma().strategyVersion.findUniqueOrThrow({
      where: { id: ready.versionId },
    });
    expect(prior.status).toBe('APPROVED');
  });
});
