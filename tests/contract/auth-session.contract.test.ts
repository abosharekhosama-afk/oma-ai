import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import type { INestApplication } from '@nestjs/common';

describe('auth contract', () => {
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
  it('exposes auth routes', async () => {
    expect((await fetch(`${baseUrl}/api/v1/auth/me`)).status).toBe(401);
  });
});
