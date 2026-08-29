import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { hashPassword, newId, SYSTEM_PROFILES } from '@oma/domain';
import { cookieHeader, createTestApp, parseCookies } from '../helpers/app';

/**
 * A member of exactly one company has nothing to choose, so the session should
 * carry that company already. A member of several must still choose, because
 * picking for them would silently scope their data to a tenant they did not ask
 * for.
 */
describe('login active tenant resolution', () => {
  let app: INestApplication;
  let baseUrl: string;
  const password = 'LoginTenant_Test_1!';

  beforeAll(async () => {
    const c = await createTestApp();
    app = c.app;
    baseUrl = c.baseUrl;
  });
  afterAll(async () => {
    await app.close();
  });

  async function createUserWithTenants(tenantCount: number) {
    const prisma = getPrisma();
    const email = `login-tenant-${newId().toLowerCase().slice(-10)}@example.invalid`;
    const user = await prisma.user.create({
      data: {
        id: newId(),
        email,
        name: 'Login Tenant Probe',
        passwordHash: await hashPassword(password),
      },
    });
    const tenantIds: string[] = [];
    for (let i = 0; i < tenantCount; i += 1) {
      const tenant = await prisma.tenant.create({
        data: {
          id: newId(),
          name: `Login Tenant ${i}`,
          slug: `login-tenant-${newId().toLowerCase().slice(-10)}`,
          status: 'ACTIVE',
        },
      });
      tenantIds.push(tenant.id);
      const membership = await prisma.membership.create({
        data: { id: newId(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' },
      });
      await prisma.capabilityGrant.createMany({
        data: SYSTEM_PROFILES.COMPANY_OWNER.map((capabilityCode) => ({
          id: newId(),
          tenantId: tenant.id,
          membershipId: membership.id,
          capabilityCode,
          grantedBy: user.id,
        })),
      });
    }
    return { email, tenantIds };
  }

  async function loginAndReadMe(email: string) {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(login.ok, `login failed: ${login.status}`).toBeTruthy();
    const cookies = parseCookies(login);
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader(cookies) },
    });
    const body = await me.json();
    expect(me.ok, JSON.stringify(body)).toBeTruthy();
    return { me: body, cookies };
  }

  it('activates the only company a user belongs to', async () => {
    const { email, tenantIds } = await createUserWithTenants(1);
    const { me, cookies } = await loginAndReadMe(email);
    expect(me.active_tenant_id).toBe(tenantIds[0]);

    // The session is genuinely scoped, not just reported as scoped.
    const brands = await fetch(`${baseUrl}/api/v1/brands`, {
      headers: { cookie: cookieHeader(cookies) },
    });
    expect(brands.status).toBe(200);
  });

  it('leaves the choice to a user who belongs to several companies', async () => {
    const { email } = await createUserWithTenants(2);
    const { me, cookies } = await loginAndReadMe(email);
    expect(me.active_tenant_id).toBeNull();

    const brands = await fetch(`${baseUrl}/api/v1/brands`, {
      headers: { cookie: cookieHeader(cookies) },
    });
    expect(brands.status).toBe(409);
    expect((await brands.json()).error.code).toBe('TENANT_REQUIRED');
  });
});
