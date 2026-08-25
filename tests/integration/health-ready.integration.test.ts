import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/app';
import type { INestApplication } from '@nestjs/common';

describe('health ready', () => {
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
  it('ready when postgres and redis available', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health/ready`);
    expect(res.status).toBe(200);
  });
});
