import { afterAll, describe, expect, it } from 'vitest';
import {
  createBrand,
  createStrategy,
  getStrategyVersion,
  patchFoundation,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy foundation integration', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });
  it('persists foundation JSON on version', async () => {
    const seed = await seedBrandTenant();
    closers.push(async () => seed.app.close());
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    await patchFoundation(
      seed,
      brand.data.id,
      created.data.id,
      created.data.latest_version.id,
      created.data.latest_version.row_version,
      {
        goals: [{ value: 'Persist me', infoClass: 'USER_AUTHORED' }],
        positioning: { value: 'Here', infoClass: 'USER_AUTHORED' },
      },
    );
    const ver = await getStrategyVersion(
      seed,
      brand.data.id,
      created.data.id,
      created.data.latest_version.id,
    );
    expect(JSON.stringify(ver.body.data.foundation ?? ver.body.data)).toMatch(/Persist me/);
  });
});
