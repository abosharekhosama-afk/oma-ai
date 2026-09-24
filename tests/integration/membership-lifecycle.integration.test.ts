import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieHeader, createTestApp, parseCookies } from '../helpers/app';
import { platformOwnerCredentials } from '../helpers/platform-owner';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@oma/domain';

async function login(baseUrl: string, email: string, password: string) {
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(login.status).toBe(200);
  return parseCookies(login);
}

describe('membership lifecycle Q-03', () => {
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

  it('invite accept suspend', async () => {
    // use bootstrap platform owner
    const owner = platformOwnerCredentials();
    const cookies = await login(baseUrl, owner.email, owner.password);
    const slug = `co-${newId().toLowerCase().slice(-8)}`;
    const created = await fetch(`${baseUrl}/api/v1/tenants`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      body: JSON.stringify({ name: 'Co', slug }),
    });
    expect([200, 201]).toContain(created.status);
    const tenantId = (await created.json()).tenant.id;
    await fetch(`${baseUrl}/api/v1/tenants/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    // refresh csrf/session cookies after switch? session same
    const inviteEmail = `member-${newId().toLowerCase()}@example.com`;
    const inv = await fetch(`${baseUrl}/api/v1/tenants/current/invitations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      body: JSON.stringify({ email: inviteEmail }),
    });
    expect([200, 201]).toContain(inv.status);
    const invBody = await inv.json();
    expect(invBody.membership_id).toBeTruthy();

    await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        password: 'CorrectHorseBattery1!',
        name: 'Member',
      }),
    });
    const memberCookies = await login(baseUrl, inviteEmail, 'CorrectHorseBattery1!');
    const accept = await fetch(`${baseUrl}/api/v1/invitations/accept`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(memberCookies),
        'x-csrf-token': memberCookies.oma_csrf,
      },
      body: JSON.stringify({ token: invBody.invite_token }),
    });
    expect([200, 201]).toContain(accept.status);

    const sus = await fetch(`${baseUrl}/api/v1/memberships/${invBody.membership_id}/suspend`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      body: '{}',
    });
    expect([200, 201]).toContain(sus.status);
  });
});
