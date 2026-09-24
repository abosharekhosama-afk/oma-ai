import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieHeader, createTestApp } from '../helpers/app';
import { loginPlatformOwner } from '../helpers/platform-owner';
import type { INestApplication } from '@nestjs/common';
import { newId } from '@oma/domain';

describe('tenant switch Q-04', () => {
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
  it('allows authorized switch and denies unknown', async () => {
    const cookies = await loginPlatformOwner(baseUrl);
    const bad = await fetch(`${baseUrl}/api/v1/tenants/active`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookieHeader(cookies),
        'x-csrf-token': cookies.oma_csrf,
      },
      body: JSON.stringify({ tenant_id: newId() }),
    });
    expect(bad.status).toBe(403);
  });
});
