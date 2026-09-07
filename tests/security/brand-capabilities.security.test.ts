import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createBrand, seedBrandTenant, seedMemberWithoutBrandCaps } from '../helpers/brand-test';

describe('brand capabilities security', () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof seedBrandTenant>>;
  let member: Awaited<ReturnType<typeof seedMemberWithoutBrandCaps>>;

  beforeAll(async () => {
    owner = await seedBrandTenant();
    member = await seedMemberWithoutBrandCaps(owner);
    app = owner.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('member without brand.read denied on list', async () => {
    const res = await fetch(`${owner.baseUrl}/api/v1/brands`, {
      headers: {
        cookie: `oma_session=${member.cookies.oma_session}`,
      },
    });
    expect(res.status).toBe(403);
  });

  it('member without brand.create denied on create', async () => {
    const res = await fetch(`${owner.baseUrl}/api/v1/brands`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `oma_session=${member.cookies.oma_session}`,
        'x-csrf-token': member.csrf,
      },
      body: JSON.stringify({ name: 'Denied' }),
    });
    expect(res.status).toBe(403);
  });

  it('owner can create brand', async () => {
    const { res } = await createBrand(owner);
    expect(res.status).toBe(201);
  });
});
