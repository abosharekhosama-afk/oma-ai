import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import type { INestApplication } from '@nestjs/common';
import { createRedisConnection, fullScanJourney, seedBrandTenant } from '../helpers/brand-test';

describe('discovery extract integration', () => {
  let app: INestApplication;
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let connection: ReturnType<typeof createRedisConnection>;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
    connection = createRedisConnection();
  });
  afterAll(async () => {
    await connection.quit();
    await app.close();
  });

  it('persists tenant-scoped pages products evidence observations', async () => {
    const journey = await fullScanJourney(seed, connection, { max_pages: 3 });
    const prisma = getPrisma();
    const pages = await prisma.discoveredPage.findMany({
      where: { tenantId: seed.tenantId, scanAttemptId: journey.scanId },
    });
    const products = await prisma.discoveredProductService.findMany({
      where: { tenantId: seed.tenantId, scanAttemptId: journey.scanId },
    });
    const evidence = await prisma.evidenceExcerpt.findMany({
      where: { tenantId: seed.tenantId, scanAttemptId: journey.scanId },
    });
    const observations = await prisma.extractedObservation.findMany({
      where: { tenantId: seed.tenantId, scanAttemptId: journey.scanId },
    });
    expect(pages.length).toBeGreaterThan(0);
    expect(evidence.length).toBeGreaterThan(0);
    expect(observations.length).toBeGreaterThan(0);
    expect(pages.every((p) => p.tenantId === seed.tenantId)).toBe(true);
    expect(products.every((p) => p.tenantId === seed.tenantId)).toBe(true);
  });
});
