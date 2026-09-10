import { afterAll, describe, expect, it } from 'vitest';
import { authHeaders, createBrand, seedBrandTenant, seedReviewReadyStrategy } from '../helpers/strategy-test';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

describe('strategy submit idempotency', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => { for (const c of closers) await c(); });

  it('duplicate submit with same idempotency key yields one IN_REVIEW', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const ready = await seedReviewReadyStrategy(seed, brand.data.id);
    const key = `submit-${newId()}`;
    const url = `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${ready.strategyId}/versions/${ready.versionId}/submit`;
    const body = JSON.stringify({ row_version: ready.rowVersion, unknowns_acknowledged: true });
    const headers = { ...authHeaders(seed), 'idempotency-key': key };
    const a = await fetch(url, { method: 'POST', headers, body });
    const b = await fetch(url, { method: 'POST', headers, body });
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);
    const decisions = await getPrisma().strategyReviewDecision.findMany({
      where: { strategyVersionId: ready.versionId, action: 'SUBMIT' },
    });
    expect(decisions.length).toBe(1);
    const version = await getPrisma().strategyVersion.findUniqueOrThrow({ where: { id: ready.versionId } });
    expect(version.status).toBe('IN_REVIEW');
  });
});
