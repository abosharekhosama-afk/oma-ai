import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieHeader, createTestApp, parseCookies } from '../helpers/app';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';

/**
 * `Membership` has no unique constraint on (tenantId, userId), so a user can
 * legitimately hold more than one ACTIVE row in the same tenant. `/auth/me`,
 * `CapabilitiesGuard`, and `TenantContextService` must agree on one effective
 * capability set: the union of grants across those ACTIVE rows, and nothing
 * from suspended rows or revoked grants.
 */
describe('duplicate membership capability union', () => {
  let app: INestApplication;
  let baseUrl: string;
  const email = `dup-${newId().toLowerCase()}@example.com`;
  const password = 'CorrectHorseBattery1!';
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    const c = await createTestApp();
    app = c.app;
    baseUrl = c.baseUrl;

    const prisma = getPrisma();
    tenantId = newId();
    await prisma.tenant.create({
      data: { id: tenantId, name: 'Dup Co', slug: `dup-${tenantId.toLowerCase().slice(-8)}` },
    });

    await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'Dup' }),
    });
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    userId = user.id;

    async function membership(status: 'ACTIVE' | 'SUSPENDED', grants: string[], revoked = false) {
      const id = newId();
      await prisma.membership.create({
        data: { id, tenantId, userId, status },
      });
      for (const capabilityCode of grants) {
        await prisma.capabilityGrant.create({
          data: {
            id: newId(),
            tenantId,
            membershipId: id,
            capabilityCode,
            grantedBy: userId,
            revokedAt: revoked ? new Date() : null,
          },
        });
      }
      return id;
    }

    // Oldest ACTIVE row first: the guard reports this membership id.
    await membership('ACTIVE', ['brand.read']);
    await membership('ACTIVE', ['brand.create']);
    await membership('ACTIVE', ['capability.assign'], true);
    await membership('SUSPENDED', ['membership.manage']);
  });

  afterAll(async () => {
    await app.close();
  });

  async function session() {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const cookies = parseCookies(res);
    await fetch(`${baseUrl}/api/v1/tenants/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    return cookies;
  }

  it('reports one membership per tenant with the union of ACTIVE grants', async () => {
    const cookies = await session();
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader(cookies) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const entries = body.memberships.filter((m: { tenant_id: string }) => m.tenant_id === tenantId);
    expect(entries).toHaveLength(1);
    const caps: string[] = entries[0].capabilities;
    expect(caps).toContain('brand.read');
    expect(caps).toContain('brand.create');
    expect(caps).not.toContain('capability.assign');
    expect(caps).not.toContain('membership.manage');
  });

  it('enforces a capability granted only on the second ACTIVE row', async () => {
    const cookies = await session();
    const res = await fetch(`${baseUrl}/api/v1/brands`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
        'idempotency-key': newId(),
      },
      body: JSON.stringify({ name: 'Union Brand' }),
    });
    expect(res.status).not.toBe(403);
  });

  it('denies a capability that only a suspended row or revoked grant carries', async () => {
    const cookies = await session();
    const res = await fetch(`${baseUrl}/api/v1/tenants/current/invitations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      body: JSON.stringify({ email: `nope-${newId().toLowerCase()}@example.com` }),
    });
    expect(res.status).toBe(403);
  });
});
