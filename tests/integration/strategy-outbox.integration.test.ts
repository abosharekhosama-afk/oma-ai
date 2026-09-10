import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  bringToApproved,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
  setCurrentStrategy,
} from '../helpers/strategy-test';

describe('strategy outbox', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('after approve, outbox event strategy.approved exists', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);

    const events = await getPrisma().outboxEvent.findMany({
      where: { tenantId: seed.tenantId, eventType: 'strategy.approved' },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const payload = JSON.parse(events[events.length - 1]!.payloadJson) as {
      strategyId: string;
      current_auto_set?: boolean;
    };
    expect(payload.strategyId).toBe(ready.strategyId);
    expect(payload.current_auto_set).toBe(false);
  });

  it('after set_current, outbox event strategy.current_changed exists', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);
    const brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    const set = await setCurrentStrategy(seed, brandId, ready.strategyId, brandRow.version);
    expect([200, 201]).toContain(set.res.status);

    const events = await getPrisma().outboxEvent.findMany({
      where: { tenantId: seed.tenantId, eventType: 'strategy.current_changed' },
    });
    expect(events.length).toBeGreaterThanOrEqual(1);
    const payload = JSON.parse(events[events.length - 1]!.payloadJson) as {
      strategyId: string | null;
      brandId: string;
    };
    expect(payload.brandId).toBe(brandId);
    expect(payload.strategyId).toBe(ready.strategyId);
  });
});
