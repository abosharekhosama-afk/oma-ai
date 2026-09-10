import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createBrand,
  grantCapability,
  memberAuthHeaders,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
} from '../helpers/strategy-test';

describe('strategy.read capability', () => {
  let owner: Awaited<ReturnType<typeof seedBrandTenant>>;
  let brandId: string;

  beforeAll(async () => {
    owner = await seedBrandTenant();
    const { body: brand } = await createBrand(owner);
    brandId = brand.data.id as string;
  });

  afterAll(async () => {
    await owner.app.close();
  });

  it('denies member without strategy.read', async () => {
    const member = await seedMemberWithoutBrandCaps(owner);
    const res = await fetch(`${owner.baseUrl}/api/v1/brands/${brandId}/strategies`, {
      headers: { cookie: memberAuthHeaders(member).cookie },
    });
    expect(res.status).toBe(403);
  });

  it('allows list after strategy.read grant', async () => {
    const member = await seedMemberWithoutBrandCaps(owner);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.read', owner.userId);
    const res = await fetch(`${owner.baseUrl}/api/v1/brands/${brandId}/strategies`, {
      headers: { cookie: memberAuthHeaders(member).cookie },
    });
    expect(res.status).toBe(200);
  });
});
