import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieHeader, createTestApp, parseCookies } from '../helpers/app';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@oma/domain';

async function login(baseUrl: string, email: string, password: string) {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseCookies(login);
}

describe('cross-tenant isolation Q-05', () => {
  let app: INestApplication;
  let baseUrl: string;
  beforeAll(async () => {
    const c = await createTestApp();
    app = c.app;
    baseUrl = c.baseUrl;
  });
  afterAll(async () => {
    await app.close();
  });

  it('denies foreign membership id', async () => {
    const ownerCookies = await login(
      baseUrl,
      'platform-owner@example.com',
      'ChangeMe_PlatformOwner_1!',
    );
    const slug1 = `t1-${newId().toLowerCase().slice(-6)}`;
    const t1 = await (
      await fetch(`${baseUrl}/api/v1/tenants`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader(ownerCookies),
          'x-csrf-token': ownerCookies.oma_csrf,
        },
        body: JSON.stringify({ name: 'T1', slug: slug1 }),
      })
    ).json();
    await fetch(`${baseUrl}/api/v1/tenants/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(ownerCookies),
        'x-csrf-token': ownerCookies.oma_csrf,
      },
      body: JSON.stringify({ tenant_id: t1.tenant.id }),
    });
    const inv = await (
      await fetch(`${baseUrl}/api/v1/tenants/current/invitations`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader(ownerCookies),
          'x-csrf-token': ownerCookies.oma_csrf,
        },
        body: JSON.stringify({ email: `x-${newId().toLowerCase()}@example.com` }),
      })
    ).json();

    const slug2 = `t2-${newId().toLowerCase().slice(-6)}`;
    const t2 = await (
      await fetch(`${baseUrl}/api/v1/tenants`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader(ownerCookies),
          'x-csrf-token': ownerCookies.oma_csrf,
        },
        body: JSON.stringify({ name: 'T2', slug: slug2 }),
      })
    ).json();
    await fetch(`${baseUrl}/api/v1/tenants/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(ownerCookies),
        'x-csrf-token': ownerCookies.oma_csrf,
      },
      body: JSON.stringify({ tenant_id: t2.tenant.id }),
    });
    const probe = await fetch(
      `${baseUrl}/api/v1/tenants/current/resource-probe/${inv.membership_id}`,
      {
        headers: { cookie: cookieHeader(ownerCookies) },
      },
    );
    expect(probe.status).toBe(404);
    const body = await probe.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
