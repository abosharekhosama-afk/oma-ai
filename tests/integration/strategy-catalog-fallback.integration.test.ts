import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import { createBrand } from '../helpers/brand-test';
import {
  authHeaders,
  bringToApproved,
  getStrategyVersion,
  linkApprovedProfile,
  seedReviewReadyStrategy,
  seedBrandTenant,
} from '../helpers/strategy-test';

describe('strategy plan catalog discovery fallback', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('preview reports discovery_fallback when profile has no catalog but scan has products', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const prisma = getPrisma();

    const websiteId = newId();
    const jobId = newId();
    const scanId = newId();
    await prisma.websiteSource.create({
      data: {
        id: websiteId,
        tenantId: seed.tenantId,
        brandId,
        normalizedUrl: 'https://catalog-fallback.test/',
        host: 'catalog-fallback.test',
        attestationAcceptedAt: new Date(),
        attestedByUserId: seed.userId,
        validationStatus: 'VALID',
      },
    });
    await prisma.jobRun.create({
      data: {
        id: jobId,
        tenantId: seed.tenantId,
        queue: 'ingestion',
        jobType: 'scan',
        payloadJson: '{}',
        actorUserId: seed.userId,
        idempotencyKey: `fallback-${newId()}`,
      },
    });
    await prisma.scanAttempt.create({
      data: {
        id: scanId,
        tenantId: seed.tenantId,
        brandId,
        websiteSourceId: websiteId,
        jobRunId: jobId,
        idempotencyKey: `scan-${newId()}`,
        actorUserId: seed.userId,
        status: 'SUCCEEDED',
        finishedAt: new Date(),
      },
    });
    await prisma.discoveredProductService.create({
      data: {
        id: newId(),
        tenantId: seed.tenantId,
        brandId,
        scanAttemptId: scanId,
        kind: 'PRODUCT',
        name: 'Fallback Product',
        description: 'From scan',
        category: 'Retail',
        priceAmount: '99',
        priceCurrency: 'SAR',
      },
    });

    const profileId = newId();
    await prisma.profileVersion.create({
      data: {
        id: profileId,
        tenantId: seed.tenantId,
        brandId,
        status: 'APPROVED',
        scanAttemptId: scanId,
        sectionsJson: JSON.stringify({ overview: { name: brand.data.name ?? 'Brand' } }),
        approvedAt: new Date(),
        incompletenessAcknowledged: true,
      },
    });
    await prisma.brandWorkspace.update({
      where: { id: brandId },
      data: { currentApprovedProfileVersionId: profileId },
    });

    const { strategyId, versionId, rowVersion } = await seedReviewReadyStrategy(seed, brandId);
    await linkApprovedProfile(
      seed,
      brandId,
      strategyId,
      versionId,
      profileId,
      rowVersion,
      'approved',
    );

    const linked = await getStrategyVersion(seed, brandId, strategyId, versionId);
    const organicTrackRv = linked.body.data.organic?.row_version as number;
    const organicRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/organic`,
      {
        method: 'PATCH',
        headers: authHeaders(seed),
        body: JSON.stringify({
          row_version: organicTrackRv,
          pillars: ['Catalog stories'],
          channels: ['Instagram'],
          formats: ['Reel'],
        }),
      },
    );
    expect(organicRes.status).toBe(200);

    const afterOrganic = await getStrategyVersion(seed, brandId, strategyId, versionId);
    await bringToApproved(
      seed,
      brandId,
      strategyId,
      versionId,
      afterOrganic.body.data.row_version as number,
    );

    const previewRes = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/strategies/${strategyId}/versions/${versionId}/plan-to-requests/preview`,
      { method: 'POST', headers: authHeaders(seed), body: '{}' },
    );
    expect(previewRes.status).toBe(201);
    const preview = await previewRes.json();
    expect(preview.data.catalog_offerings_count).toBeGreaterThan(0);
    expect(preview.data.catalog_source).toBe('discovery_fallback');
  });
});
