import { afterAll, describe, expect, it } from 'vitest';
import {
  createBrand,
  createStrategy,
  patchFoundation,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy foundation contract', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });
  it('patches foundation goals and positioning', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const patched = await patchFoundation(
      seed,
      brand.data.id,
      created.data.id,
      created.data.latest_version.id,
      created.data.latest_version.row_version,
      {
        goals: [{ value: 'Grow', infoClass: 'USER_AUTHORED' }],
        positioning: { value: 'Partner', infoClass: 'USER_AUTHORED' },
      },
    );
    expect([200, 201]).toContain(patched.res.status);
  });
});
