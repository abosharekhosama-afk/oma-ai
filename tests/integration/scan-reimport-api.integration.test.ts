import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';
import type { INestApplication } from '@nestjs/common';
import { authHeaders, createBrand, seedBrandTenant } from '../helpers/brand-test';

describe('scan catalog reimport API (005 T014)', () => {
  let seed: Awaited<ReturnType<typeof seedBrandTenant>>;
  let app: INestApplication;

  beforeAll(async () => {
    seed = await seedBrandTenant();
    app = seed.app;
  });

  afterAll(async () => {
    await app.close();
  });

  it('queues catalog.reimport and returns job id', async () => {
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
        normalizedUrl: 'https://reimport-api.test/',
        host: 'reimport-api.test',
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
        idempotencyKey: `reimport-${newId()}`,
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
      },
    });

    const res = await fetch(
      `${seed.baseUrl}/api/v1/brands/${brandId}/scans/${scanId}/catalog/reimport-media`,
      { method: 'POST', headers: authHeaders(seed) },
    );
    if (res.status === 503) {
      expect((await res.json()).code).toBe('PROVIDER_NOT_CONFIGURED');
      return;
    }
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.data.queued).toBe(true);
    expect(body.data.job_id).toBeTruthy();
  });
});
