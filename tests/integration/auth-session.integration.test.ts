import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieHeader, createTestApp, parseCookies } from '../helpers/app';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@oma/domain';

describe('auth session Q-01 Q-02', () => {
  let app: INestApplication;
  let baseUrl: string;
  beforeAll(async () => {
    const created = await createTestApp();
    app = created.app;
    baseUrl = created.baseUrl;
  });
  afterAll(async () => {
    await app.close();
  });

  it('register login me logout revoke', async () => {
    const email = `user-${newId().toLowerCase()}@example.com`;
    const password = 'CorrectHorseBattery1!';
    const reg = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'User' }),
    });
    expect([200, 201]).toContain(reg.status);

    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(200);
    const cookies = parseCookies(login);
    expect(cookies.oma_session).toBeTruthy();
    expect(cookies.oma_csrf).toBeTruthy();

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader(cookies) },
    });
    expect(me.status).toBe(200);
    const meBody = await me.json();
    expect(meBody.user.email).toBe(email);

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    expect(logout.status).toBe(200);

    const me2 = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: cookieHeader(cookies) },
    });
    expect(me2.status).toBe(401);
  });
});
