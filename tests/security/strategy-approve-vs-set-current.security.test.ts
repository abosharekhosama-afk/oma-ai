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
  setCurrentStrategy,
} from '../helpers/strategy-test';

describe('approve vs set_current separation', () => {
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

  it('approve leaves currentApprovedStrategyId null', async () => {
    const brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(brand.currentApprovedStrategyId).toBeNull();
  });

  it('set_current requires separate strategy.set_current capability', async () => {
    const member = await seedMemberWithoutBrandCaps(owner);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.read', owner.userId);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.approve', owner.userId);
    const brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    const denied = await fetch(`${owner.baseUrl}/api/v1/brands/${brandId}/current-strategy`, {
      method: 'POST',
      headers: memberAuthHeaders(member),
      body: JSON.stringify({ strategy_id: strategyId, brand_version: brand.version }),
    });
    expect(denied.status).toBe(403);

    await grantCapability(
      owner.tenantId,
      member.membershipId,
      'strategy.set_current',
      owner.userId,
    );
    const allowed = await fetch(`${owner.baseUrl}/api/v1/brands/${brandId}/current-strategy`, {
      method: 'POST',
      headers: memberAuthHeaders(member),
      body: JSON.stringify({ strategy_id: strategyId, brand_version: brand.version }),
    });
    expect([200, 201]).toContain(allowed.status);
    const after = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(after.currentApprovedStrategyId).toBe(strategyId);
  });

  it('owner set_current still works as package control', async () => {
    // Reset pointer then set as owner to prove approve≠current is the product rule
    const brand = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    await setCurrentStrategy(owner, brandId, null, brand.version);
    const cleared = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(cleared.currentApprovedStrategyId).toBeNull();
  });
});
