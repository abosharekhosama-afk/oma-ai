import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import {
  authHeaders,
  connectWebsite,
  createBrand,
  FIXTURE_WEBSITE_URL,
  seedBrandTenant,
  startScan,
} from '../helpers/brand-test';

describe('brand archive integration', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });
  afterAll(async () => {
    await app.close();
  });

  it('archive cancels active scan and sets ARCHIVED', async () => {
    const { body: brand } = await createBrand(seed);
    await connectWebsite(seed, brand.data.id, FIXTURE_WEBSITE_URL, brand.data.version);
    const prisma = getPrisma();
    const afterConnect = await prisma.brandWorkspace.findUniqueOrThrow({
      where: { id: brand.data.id },
    });
    await startScan(seed, brand.data.id, newId());

    const archive = await fetch(`${seed.baseUrl}/api/v1/brands/${brand.data.id}/archive`, {
      method: 'POST',
      headers: authHeaders(seed),
      body: JSON.stringify({ version: afterConnect.version }),
    });
    expect([200, 201]).toContain(archive.status);
    const body = await archive.json();
    expect(body.data.status).toBe('ARCHIVED');

    const scans = await prisma.scanAttempt.findMany({ where: { brandId: brand.data.id } });
    expect(scans.every((s) => s.status === 'CANCELLED' || s.status !== 'QUEUED')).toBe(true);
  });
});
