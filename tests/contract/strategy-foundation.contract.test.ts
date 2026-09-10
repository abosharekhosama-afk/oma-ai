import { afterAll, describe, expect, it } from 'vitest';
import {
  createBrand,
  createStrategy,
  patchFoundation,
  seedBrandTenant,
  seedReviewReadyStrategy,
  submitStrategy,
} from '../helpers/strategy-test';

describe('strategy foundation contract', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('patches foundation and conflicts on stale row_version', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    const rowVersion = created.data.latest_version.row_version as number;

    const ok = await patchFoundation(seed, brand.data.id, strategyId, versionId, rowVersion, {
      goals: [{ value: 'G1', infoClass: 'USER_AUTHORED' }],
      positioning: { value: 'P1', infoClass: 'USER_AUTHORED' },
    });
    expect([200, 201]).toContain(ok.res.status);

    const stale = await patchFoundation(seed, brand.data.id, strategyId, versionId, rowVersion, {
      goals: [{ value: 'stale', infoClass: 'USER_AUTHORED' }],
      positioning: { value: 'stale', infoClass: 'USER_AUTHORED' },
    });
    expect(stale.res.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT_VERSION');
  });

  it('rejects foundation patch on IN_REVIEW', async () => {
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
    expect(submitted.body.data.status).toBe('IN_REVIEW');
    const blocked = await patchFoundation(
      seed,
      brand.data.id,
      ready.strategyId,
      ready.versionId,
      submitted.body.data.row_version,
      { goals: [{ value: 'nope', infoClass: 'USER_AUTHORED' }] },
    );
    expect(blocked.res.status).toBe(409);
  });
});
