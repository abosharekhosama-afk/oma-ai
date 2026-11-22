import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import {
  authHeaders,
  bringToApproved,
  createBrand,
  getStrategy,
  grantCapability,
  memberAuthHeaders,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

/** DEC-030: approve → current, effective current for older data, localized display status. */
describe('strategy approve sets current (DEC-030)', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  async function brandDetail(brandId: string) {
    const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}`, {
      headers: { cookie: authHeaders(seed).cookie },
    });
    return (await res.json()).data as {
      current_approved_strategy_id: string | null;
      current_strategy_inferred: boolean;
      active_strategy_count: number;
    };
  }

  it('owner approve sets the brand pointer, audits it, and the brand journey sees it', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const before = await brandDetail(brandId);
    expect(before.current_approved_strategy_id).toBeNull();

    const ready = await seedReviewReadyStrategy(seed, brandId);
    expect((await brandDetail(brandId)).active_strategy_count).toBe(1);
    await bringToApproved(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);

    const row = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(row.currentApprovedStrategyId).toBe(ready.strategyId);
    const audit = await getPrisma().auditEvent.findFirst({
      where: { tenantId: seed.tenantId, action: 'strategy.current_set', targetId: brandId },
    });
    expect(audit?.afterRef).toBe(ready.strategyId);

    const detail = await brandDetail(brandId);
    expect(detail.current_approved_strategy_id).toBe(ready.strategyId);
    expect(detail.current_strategy_inferred).toBe(false);

    const strat = await getStrategy(seed, brandId, ready.strategyId);
    expect(strat.body.data.is_current).toBe(true);
    expect(strat.body.data.display_status).toBe('CURRENT');
    expect(strat.body.data.latest_version.linked_profile?.id).toBeTruthy();
  });

  it('approved-but-not-current data is treated as current (inferred) without writing', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    await bringToApproved(seed, brandId, ready.strategyId, ready.versionId, ready.rowVersion);
    // Simulate a pre-DEC-030 approval: pointer never set.
    await getPrisma().brandWorkspace.update({
      where: { id: brandId },
      data: { currentApprovedStrategyId: null },
    });

    const detail = await brandDetail(brandId);
    expect(detail.current_approved_strategy_id).toBe(ready.strategyId);
    expect(detail.current_strategy_inferred).toBe(true);

    const current = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/current-strategy`, {
      headers: { cookie: authHeaders(seed).cookie },
    });
    const body = (await current.json()).data;
    expect(body.strategy.id).toBe(ready.strategyId);
    expect(body.inferred).toBe(true);

    const list = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/strategies`, {
      headers: { cookie: authHeaders(seed).cookie },
    });
    const rows = (await list.json()).data as Array<{
      id: string;
      is_current: boolean;
      current_inferred: boolean;
      display_status: string;
    }>;
    const mine = rows.find((r) => r.id === ready.strategyId)!;
    expect(mine.is_current).toBe(true);
    expect(mine.current_inferred).toBe(true);
    expect(mine.display_status).toBe('CURRENT');

    // Reads never write the pointer.
    const row = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(row.currentApprovedStrategyId).toBeNull();
  });

  it('a draft strategy shows DRAFT, not the ACTIVE lifecycle flag', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const ready = await seedReviewReadyStrategy(seed, brandId);
    const strat = await getStrategy(seed, brandId, ready.strategyId);
    expect(strat.body.data.status).toBe('ACTIVE');
    expect(strat.body.data.display_status).toBe('DRAFT');
    expect(strat.body.data.is_current).toBe(false);
  });

  it('an approver without strategy.set_current approves but does not move the pointer', async () => {
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
    const member = await seedMemberWithoutBrandCaps(seed);
    await grantCapability(seed.tenantId, member.membershipId, 'strategy.read', seed.userId);
    await grantCapability(seed.tenantId, member.membershipId, 'strategy.approve', seed.userId);
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${ready.strategyId}/versions/${ready.versionId}/approve`,
      {
        method: 'POST',
        headers: memberAuthHeaders(member),
        body: JSON.stringify({
          row_version: submitted.body.data.row_version,
          unknowns_acknowledged: true,
        }),
      },
    );
    expect([200, 201]).toContain(res.status);
    const row = await getPrisma().brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    expect(row.currentApprovedStrategyId).toBeNull();
  });
});
