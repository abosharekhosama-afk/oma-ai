import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import type { INestApplication } from '@nestjs/common';

describe('tenant contract', () => {
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
  it('requires auth for tenant create', async () => {
    const res = await fetch(`${baseUrl}/api/v1/tenants`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
  });
});
