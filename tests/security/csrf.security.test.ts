import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieHeader, createTestApp, parseCookies } from '../helpers/app';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@oma/domain';

describe('csrf', () => {
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

  it('rejects mutating request without csrf', async () => {
    const email = `csrf-${newId().toLowerCase()}@example.com`;
    const password = 'CorrectHorseBattery1!';
    await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'U' }),
    });
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const cookies = parseCookies(login);
    const res = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        cookie: cookieHeader({ oma_session: cookies.oma_session }),
        'content-type': 'application/json',
      },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });
});
