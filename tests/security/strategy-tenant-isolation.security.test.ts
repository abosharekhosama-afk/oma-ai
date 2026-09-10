import { afterAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createBrand,
  createStrategy,
  grantCapability,
  seedBrandTenant,
  seedMemberWithoutBrandCaps,
} from '../helpers/brand-test';

describe('strategy security', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const c of closers) await c();
  });

  it('denies cross-tenant strategy access without existence leak', async () => {
    const ownerA = await seedBrandTenant({ tenantSlug: `a-${Date.now()}` });
    closers.push(async () => ownerA.app.close());
    const ownerB = await seedBrandTenant({ tenantSlug: `b-${Date.now()}` });
    closers.push(async () => ownerB.app.close());
    const { body: brandA } = await createBrand(ownerA);
    const { body: stratA } = await createStrategyVia(ownerA, brandA.data.id);
    const res = await fetch(
      `${ownerB.baseUrl}/api/v1/brands/${brandA.data.id}/strategies/${stratA.data.id}`,
      { headers: { cookie: authHeaders(ownerB).cookie } },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('denies member without strategy.read', async () => {
    const owner = await seedBrandTenant();
    closers.push(async () => owner.app.close());
    const member = await seedMemberWithoutBrandCaps(owner);
    const { body: brand } = await createBrand(owner);
    await createStrategyVia(owner, brand.data.id);
    const res = await fetch(`${owner.baseUrl}/api/v1/brands/${brand.data.id}/strategies`, {
      headers: {
        cookie: Object.entries(member.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    expect(res.status).toBe(403);
  });

  it('allows strategy.read after grant', async () => {
    const owner = await seedBrandTenant();
    closers.push(async () => owner.app.close());
    const member = await seedMemberWithoutBrandCaps(owner);
    await grantCapability(owner.tenantId, member.membershipId, 'strategy.read', owner.userId);
    const { body: brand } = await createBrand(owner);
    const res = await fetch(`${owner.baseUrl}/api/v1/brands/${brand.data.id}/strategies`, {
      headers: {
        cookie: Object.entries(member.cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      },
    });
    expect(res.status).toBe(200);
  });
});

async function createStrategyVia(
  seed: Awaited<ReturnType<typeof seedBrandTenant>>,
  brandId: string,
) {
  const res = await fetch(`${seed.baseUrl}/api/v1/brands/${brandId}/strategies`, {
    method: 'POST',
    headers: authHeaders(seed),
    body: JSON.stringify({ name: 'Sec Strategy' }),
  });
  return { res, body: await res.json() };
}
