import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  bringToApproved,
  createBrand,
  grantCapability,
  memberAuthHeaders,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
  seedReviewReadyStrategy,
} from '../helpers/strategy-test';

describe('strategy.set_current authorization', () => {
  let owner: Awaited<ReturnType<typeof seedBrandTenant>>;
  let brandId: string;
  let strategyId: string;

  beforeAll(async () => {
    owner = await seedBrandTenant();
    const { body: brand } = await createBrand(owner);
    brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(owner, brandId);
    await bringToApproved(owner, brandId, ready.strategyId, ready.versionId, ready.rowVersion);
    strategyId = ready.strategyId;
  });

  afterAll(async () => {
    await owner.app.close();
  });

  it('denies set_current without strategy.set_current', async () => {
    const member = await seedMemberWithoutBrandCaps(owner);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.read', owner.userId);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.approve', owner.userId);
    const brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    const res = await fetch(`${owner.baseUrl}/api/v1/brands/${brandId}/current-strategy`, {
      method: 'POST',
      headers: memberAuthHeaders(member),
      body: JSON.stringify({ strategy_id: strategyId, brand_version: brand.version }),
    });
    expect(res.status).toBe(403);
  });
});
