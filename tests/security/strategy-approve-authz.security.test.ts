import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createBrand,
  grantCapability,
  memberAuthHeaders,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy.approve authorization', () => {
  let owner: Awaited<ReturnType<typeof seedBrandTenant>>;
  let brandId: string;
  let strategyId: string;
  let versionId: string;
  let rowVersion: number;

  beforeAll(async () => {
    owner = await seedBrandTenant();
    const { body: brand } = await createBrand(owner);
    brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(owner, brandId);
    const submitted = await submitStrategy(
      owner,
      brandId,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    strategyId = ready.strategyId;
    versionId = ready.versionId;
    rowVersion = submitted.body.data.row_version as number;
  });

  afterAll(async () => {
    await owner.app.close();
  });

  it('member without strategy.approve gets 403 on approve', async () => {
    const member = await seedMemberWithoutBrandCaps(owner);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.read', owner.userId);
    const res = await fetch(
      `${owner.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/approve`,
      {
        method: 'POST',
        headers: memberAuthHeaders(member),
        body: JSON.stringify({
          row_version: rowVersion,
          unknowns_acknowledged: true,
          comment: 'Nope',
        }),
      },
    );
    expect(res.status).toBe(403);
  });

  it('member with strategy.approve grant succeeds', async () => {
    const member = await seedMemberWithoutBrandCaps(owner);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.read', owner.userId);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.approve', owner.userId);
    const res = await fetch(
      `${owner.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/approve`,
      {
        method: 'POST',
        headers: memberAuthHeaders(member),
        body: JSON.stringify({
          row_version: rowVersion,
          unknowns_acknowledged: true,
          comment: 'Granted approve',
        }),
      },
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.status).toBe('APPROVED');
  });
});
