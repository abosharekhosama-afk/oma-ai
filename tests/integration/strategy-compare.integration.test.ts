import { afterAll, describe, expect, it } from 'vitest';
import {
  approveStrategy,
  authHeaders,
  createBrand,
  getStrategyVersion,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';
import { getPrisma } from '@oma/db';

describe('strategy revise/clone/supersede', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('revise from approved creates new draft without approval inheritance', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const ready = await seedReviewReadyStrategy(seed, brand.data.id);
    const submitted = await submitStrategy(
      seed,
      brand.data.id,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    await approveStrategy(
      seed,
      brand.data.id,
      ready.strategyId,
      ready.versionId,
      submitted.body.data.row_version,
    );
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${ready.strategyId}/versions/${ready.versionId}/revise`,
      { method: 'POST', headers: authHeaders(seed), body: '{}' },
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.version_number).toBeGreaterThan(1);
    const approval = await getPrisma().strategyApprovalRecord.findUnique({
      where: { strategyVersionId: body.data.id },
    });
    expect(approval).toBeNull();
  });

  it('clone creates new strategy with origin lineage and no current inheritance', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const ready = await seedReviewReadyStrategy(seed, brand.data.id);
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${ready.strategyId}/versions/${ready.versionId}/clone`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({ name: 'Cloned Strategy' }),
      },
    );
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.id).not.toBe(ready.strategyId);
    expect(body.data.origin_strategy_id).toBe(ready.strategyId);
    expect(body.data.is_current).toBe(false);
    const brandRow = await getPrisma().brandWorkspace.findUniqueOrThrow({
      where: { id: brand.data.id },
    });
    expect(brandRow.currentApprovedStrategyId).toBeNull();
  });

  it('second approve supersedes prior approved version in same strategy', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const ready = await seedReviewReadyStrategy(seed, brand.data.id);
    const s1 = await submitStrategy(
      seed,
      brand.data.id,
      ready.strategyId,
      ready.versionId,
      ready.rowVersion,
    );
    await approveStrategy(
      seed,
      brand.data.id,
      ready.strategyId,
      ready.versionId,
      s1.body.data.row_version,
    );
    const revise = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${ready.strategyId}/versions/${ready.versionId}/revise`,
      { method: 'POST', headers: authHeaders(seed), body: '{}' },
    );
    const draft = await revise.json();
    const draftId = draft.data.id as string;
    let row = draft.data.row_version as number;
    await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${ready.strategyId}/versions/${draftId}/tracks/enablement`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: row,
          organic_enabled: true,
          paid_enabled: false,
          paid_disabled_rationale: 'Still deferred',
        }),
      },
    );
    const after = await getStrategyVersion(seed, brand.data.id, ready.strategyId, draftId);
    row = after.body.data.row_version;
    const s2 = await submitStrategy(seed, brand.data.id, ready.strategyId, draftId, row);
    await approveStrategy(seed, brand.data.id, ready.strategyId, draftId, s2.body.data.row_version);
    const prior = await getPrisma().strategyVersion.findUniqueOrThrow({
      where: { id: ready.versionId },
    });
    expect(prior.status).toBe('SUPERSEDED');
  });
});
