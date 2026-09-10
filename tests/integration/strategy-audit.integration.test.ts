import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  bringToApproved,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

describe('strategy audit', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('after approve, audit log row exists for strategy.approved_package', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);

    const audits = await getPrisma().auditEvent.findMany({
      where: {
        tenantId: seed.tenantId,
        targetId: ready.versionId,
        action: 'strategy.approved_package',
      },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    expect(audits[0]!.targetType).toBe('StrategyVersion');
  });
});
