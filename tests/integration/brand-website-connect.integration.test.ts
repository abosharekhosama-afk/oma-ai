import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import type { INestApplication } from '@nestjs/common';
import {
  connectWebsite,
  createBrand,
  FIXTURE_WEBSITE_URL,
  seedBrandTenant,
} from '../helpers/brand-test';

describe('brand website connect integration', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('connect increments source revision without mutating approved pointer', async () => {
    const { body: brand } = await createBrand(seed);
    const first = await connectWebsite(
      seed,
      brand.data.id,
      FIXTURE_WEBSITE_URL,
      brand.data.version,
    );
    expect([200, 201]).toContain(first.res.status);
    expect(first.body.data.source_revision).toBe(1);

    const prisma = getPrisma();
    const refreshed = await prisma.brandWorkspace.findUniqueOrThrow({
      where: { id: brand.data.id },
    });
    const second = await connectWebsite(
      seed,
      brand.data.id,
      'https://acme.test/products.html',
      refreshed.version,
    );
    expect([200, 201]).toContain(second.res.status);
    expect(second.body.data.source_revision).toBe(2);
    expect(refreshed.currentApprovedProfileVersionId).toBeNull();
  });
});
