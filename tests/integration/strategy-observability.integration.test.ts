import { afterAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy observability', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('covers observability uniquely', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await submitStrategy(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);
    const audits = await getPrisma().auditEvent.findMany({
      where: { tenantId: seed.tenantId, action: { contains: 'strategy' } },
      take: 5,
    });
    expect(audits.length).toBeGreaterThan(0);
  });
});
