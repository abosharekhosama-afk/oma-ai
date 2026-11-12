import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { buildBrandContext } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import {
  approveProfile,
  createRedisConnection,
  fullScanJourney,
  getProfile,
  seedBrandTenant,
} from '../helpers/brand-test';
import { createStrategy, linkApprovedProfile } from '../helpers/strategy-test';

describe('brand catalog → profile → strategy chain', () => {
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

  it(
    'links scan catalog through approved profile into strategy and brand context',
    async () => {
    const journey = await fullScanJourney(seed, connection, { max_pages: 4, max_depth: 2 });
    expect(journey.profileVersionId).toBeTruthy();

    const prisma = getPrisma();
    const products = await prisma.discoveredProductService.findMany({
      where: { tenantId: seed.tenantId, scanAttemptId: journey.scanId },
    });
    expect(products.some((p) => p.name.includes('Widget'))).toBe(true);

    const catalogObs = await prisma.extractedObservation.findMany({
      where: {
        tenantId: seed.tenantId,
        scanAttemptId: journey.scanId,
        fieldKey: { in: ['catalog.products', 'catalog.services'] },
      },
    });
    expect(catalogObs.length).toBeGreaterThan(0);
    expect(catalogObs.every((o) => o.evidenceId)).toBe(true);

    const profileRow = await prisma.profileVersion.findUnique({
      where: { id: journey.profileVersionId! },
    });
    const sections = profileRow?.sectionsJson
      ? (JSON.parse(profileRow.sectionsJson) as { catalog?: { products?: { summary?: string } } })
      : {};
    expect(sections.catalog?.products?.summary).toMatch(/Widget/i);

    const { body: profileApi } = await getProfile(seed, journey.brandId, journey.profileVersionId!);
    const approved = await approveProfile(
      seed,
      journey.brandId,
      journey.profileVersionId!,
      profileApi.data.row_version,
    );
    expect([200, 201]).toContain(approved.res.status);

    const brand = await prisma.brandWorkspace.findUnique({ where: { id: journey.brandId } });
    expect(brand?.currentApprovedProfileVersionId).toBe(journey.profileVersionId);

    const { res: stratRes, body: stratBody } = await createStrategy(seed, journey.brandId, {
      name: 'Post-scan strategy',
    });
    expect([200, 201]).toContain(stratRes.status);
    const strategyId = stratBody.data.id as string;
    const versionId = stratBody.data.latest_version.id as string;
    const rowVersion = stratBody.data.latest_version.row_version as number;

    const linked = await linkApprovedProfile(
      seed,
      journey.brandId,
      strategyId,
      versionId,
      journey.profileVersionId!,
      rowVersion,
      'approved',
    );
    expect([200, 201]).toContain(linked.res.status);

    const approvedProfile = await prisma.profileVersion.findUnique({
      where: { id: journey.profileVersionId! },
    });
    const claims = await prisma.insightClaim.findMany({
      where: { profileVersionId: journey.profileVersionId! },
    });
    const ctx = buildBrandContext({
      tenantId: seed.tenantId,
      brandId: journey.brandId,
      brandName: brand?.name ?? 'Acme',
      profile: approvedProfile,
      claims: claims.map((c) => ({
        fieldKey: c.fieldKey,
        text: c.textValue ?? '',
        reviewStatus: c.reviewStatus,
      })),
    });
    expect(ctx.usedApprovedProfile).toBe(true);
    expect(ctx.products.toLowerCase()).toMatch(/widget/);
    },
    120_000,
  );
});
