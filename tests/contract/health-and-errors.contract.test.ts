import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import type { INestApplication } from '@nestjs/common';

describe('health contract', () => {
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

  it('live returns ok', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health/live`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('ready returns ready when deps up', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health/ready`);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ready');
  });

  it('error envelope shape on 404-ish auth', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.correlation_id).toBeTruthy();
    expect(body.error.request_id).toBeTruthy();
    expect(body.error.message_key).toBeTruthy();
  });
});
