import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy AI propose contract', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
  });

  afterAll(async () => {
    await seed.app.close();
  });

  it('AI propose returns 503 with refusal code (DEC-016)', async () => {
    const { body: brand } = await createBrand(seed);
    const { body: created } = await createStrategy(seed, brand.data.id);
    const strategyId = created.data.id as string;
    const versionId = created.data.latest_version.id as string;
    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brand.data.id}/strategies/${strategyId}/versions/${versionId}/ai/propose`,
      {
        method: 'POST',
        headers: authHeaders(seed),
        body: '{}',
      },
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(['AI_NOT_CONFIGURED', 'AI_REFUSED', 'AI_UNAVAILABLE']).toContain(body.error.code);
    expect(body.error.details?.[0]?.manual_journey ?? body.error.details?.[0]?.code).toBeTruthy();
  });
});
