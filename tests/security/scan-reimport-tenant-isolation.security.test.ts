import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('scan reimport tenant isolation (005 T015)', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects reimport when scan belongs to another brand', async () => {
    const { body: brandA } = await createBrand(seed);
    const { body: brandB } = await createBrand(seed);
    const prisma = getPrisma();
    const websiteId = newId();
    const jobId = newId();
    const scanId = newId();
    await prisma.websiteSource.create({
      data: {
        id: websiteId,
        tenantId: seed.tenantId,
        brandId: brandA.data.id as string,
        normalizedUrl: 'https://iso-a.test/',
        host: 'iso-a.test',
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
        idempotencyKey: `iso-${newId()}`,
      },
    });
    await prisma.scanAttempt.create({
      data: {
        id: scanId,
        tenantId: seed.tenantId,
        brandId: brandA.data.id as string,
        websiteSourceId: websiteId,
        jobRunId: jobId,
        idempotencyKey: `scan-iso-${newId()}`,
        actorUserId: seed.userId,
        status: 'SUCCEEDED',
      },
    });

    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandB.data.id}/scans/${scanId}/catalog/reimport-media`,
      { method: 'POST', headers: authHeaders(seed) },
    );
    expect(res.status).toBe(404);
  });
});
