import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieHeader, createTestApp } from '../helpers/app';
import { loginPlatformOwner } from '../helpers/platform-owner';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@oma/domain';

describe('idempotency Q-07', () => {
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
  it('replays same invite key', async () => {
    const cookies = await loginPlatformOwner(baseUrl);
    const slug = `idem-${newId().toLowerCase().slice(-6)}`;
    const created = await (
      await fetch(`${baseUrl}/api/v1/tenants`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader(cookies),
          'x-csrf-token': cookies.oma_csrf,
        },
        body: JSON.stringify({ name: 'Idem', slug }),
      })
    ).json();
    await fetch(`${baseUrl}/api/v1/tenants/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      body: JSON.stringify({ tenant_id: created.tenant.id }),
    });
    const key = newId();
    const body = JSON.stringify({ email: `idem-${newId().toLowerCase()}@example.com` });
    const headers = {
      'content-type': 'application/json',
      cookie: cookieHeader(cookies),
      'x-csrf-token': cookies.oma_csrf,
      'idempotency-key': key,
    };
    const a = await fetch(`${baseUrl}/api/v1/tenants/current/invitations`, {
      method: 'POST',
      headers,
      body,
    });
    const b = await fetch(`${baseUrl}/api/v1/tenants/current/invitations`, {
      method: 'POST',
      headers,
      body,
    });
    expect(a.status).toBe(b.status);
    expect(await a.json()).toEqual(await b.json());
  });
});
