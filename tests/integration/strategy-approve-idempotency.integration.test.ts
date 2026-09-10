import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import {
  approveStrategy,
  authHeaders,
  createBrand,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy approve idempotency', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('double approve same version: same idempotency key is replay; exactly one approval record', async () => {
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
    const key = `approve-${newId()}`;
    const url = `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${ready.strategyId}/versions/${ready.versionId}/approve`;
    const payload = JSON.stringify({
      row_version: submitted.body.data.row_version,
      unknowns_acknowledged: true,
      comment: 'Once',
    });
    const headers = { ...authHeaders(seed), 'idempotency-key': key };
    const first = await fetch(url, { method: 'POST', headers, body: payload });
    expect([200, 201]).toContain(first.status);
    const firstBody = await first.json();
    expect(firstBody.data.status).toBe('APPROVED');

    const second = await fetch(url, { method: 'POST', headers, body: payload });
    expect([200, 201]).toContain(second.status);
    const secondBody = await second.json();
    expect(secondBody.data.status).toBe('APPROVED');
    expect(secondBody.data.id).toBe(firstBody.data.id);

    const records = await getPrisma().strategyApprovalRecord.findMany({
      where: { strategyVersionId: ready.versionId },
    });
    expect(records).toHaveLength(1);
  });

  it('second approve without idempotency key conflicts and does not duplicate record', async () => {
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
    const first = await approveStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      submitted.body.data.row_version,
    );
    expect([200, 201]).toContain(first.res.status);
    const second = await approveStrategy(
      seed,
      brandId,
      ready.strategyId,
      ready.versionId,
      first.body.data.row_version,
    );
    expect(second.res.status).toBe(409);
    const records = await getPrisma().strategyApprovalRecord.findMany({
      where: { strategyVersionId: ready.versionId },
    });
    expect(records).toHaveLength(1);
  });
});
