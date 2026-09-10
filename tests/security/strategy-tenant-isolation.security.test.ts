import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy tenant isolation', () => {
  let ownerA: Awaited<ReturnType<typeof seedBrandTenant>>;
  let ownerB: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    ownerA = await seedBrandTenant({ tenantSlug: `a-${Date.now()}` });
    ownerB = await seedBrandTenant({ tenantSlug: `b-${Date.now()}` });
  });

  afterAll(async () => {
    await ownerA.app.close();
    await ownerB.app.close();
  });

  it('returns 404 NOT_FOUND for cross-tenant strategy GET (no existence leak)', async () => {
    const { body: brandA } = await createBrand(ownerA);
    const { body: stratA } = await createStrategy(ownerA, brandA.data.id, { name: 'Private' });
    const res = await fetch(
      `${ownerB.baseUrl}/api/v1/brands/${brandA.data.id}/strategies/${stratA.data.id}`,
      { headers: { cookie: authHeaders(ownerB).cookie } },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe('NOT_FOUND');
  });
});
