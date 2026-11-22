import { getPrisma } from '@oma/db';
import { newId } from '@oma/domain';

/** Create a SUCCEEDED ScanAttempt (with its website source and job) for FK-bound fixtures. */
export async function seedSucceededScanAttempt(input: {
  tenantId: string;
  brandId: string;
  userId: string;
  host?: string;
}) {
  const prisma = getPrisma();
  const host = input.host ?? `scan-${newId().slice(-6)}.test`;
  const websiteId = newId();
  const jobId = newId();
  const scanId = newId();
  await prisma.websiteSource.create({
    data: {
      id: websiteId,
      tenantId: input.tenantId,
      brandId: input.brandId,
      normalizedUrl: `https://${host}/`,
      host,
      attestationAcceptedAt: new Date(),
      attestedByUserId: input.userId,
      validationStatus: 'VALID',
    },
  });
  await prisma.jobRun.create({
    data: {
      id: jobId,
      tenantId: input.tenantId,
      queue: 'ingestion',
      jobType: 'scan',
      payloadJson: '{}',
      actorUserId: input.userId,
      idempotencyKey: `scan-fixture-${newId()}`,
    },
  });
  await prisma.scanAttempt.create({
    data: {
      id: scanId,
      tenantId: input.tenantId,
      brandId: input.brandId,
      websiteSourceId: websiteId,
      jobRunId: jobId,
      idempotencyKey: `scan-${newId()}`,
      actorUserId: input.userId,
      status: 'SUCCEEDED',
    },
  });
  return scanId;
}
