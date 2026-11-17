import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enqueueBrandAnalysis, getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import { createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('enqueueBrandAnalysis idempotency (005 T020)', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;
  const prevAdapter = process.env.AI_TEST_ADAPTER;

  beforeAll(async () => {
    process.env.AI_TEST_ADAPTER = '1';
    delete process.env.AI_LIVE_ENABLED;
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    if (prevAdapter === undefined) delete process.env.AI_TEST_ADAPTER;
    else process.env.AI_TEST_ADAPTER = prevAdapter;
    await app.close();
  });

  it('returns same jobRunId for scan + profile pair', async () => {
    const { body: brand } = await createBrand(seed);
    const brandId = brand.data.id as string;
    const prisma = getPrisma();
    const websiteId = newId();
    const jobId = newId();
    const scanId = newId();
    const profileId = newId();
    await prisma.websiteSource.create({
      data: {
        id: websiteId,
        tenantId: seed.tenantId,
        brandId,
        normalizedUrl: 'https://analysis-idem.test/',
        host: 'analysis-idem.test',
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
        idempotencyKey: `idem-scan-${newId()}`,
      },
    });
    await prisma.scanAttempt.create({
      data: {
        id: scanId,
        tenantId: seed.tenantId,
        brandId,
        websiteSourceId: websiteId,
        jobRunId: jobId,
        idempotencyKey: `idem-key-${newId()}`,
        actorUserId: seed.userId,
        status: 'SUCCEEDED',
      },
    });
    await prisma.profileVersion.create({
      data: {
        id: profileId,
        tenantId: seed.tenantId,
        brandId,
        status: 'DRAFT',
        scanAttemptId: scanId,
      },
    });

    const first = await enqueueBrandAnalysis({
      tenantId: seed.tenantId,
      brandId,
      scanAttemptId: scanId,
      profileVersionId: profileId,
      actorUserId: seed.userId,
    });
    expect(first.queued).toBe(true);
    expect(first.jobRunId).toBeTruthy();

    const second = await enqueueBrandAnalysis({
      tenantId: seed.tenantId,
      brandId,
      scanAttemptId: scanId,
      profileVersionId: profileId,
      actorUserId: seed.userId,
    });
    expect(second.queued).toBe(false);
    expect(second.reason).toBe('idempotent');
    expect(second.jobRunId).toBe(first.jobRunId);
  });
});
