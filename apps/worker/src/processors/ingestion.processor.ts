import { getPrisma } from '@oma/db';
import {
  createFixtureWebsiteConnector,
  isBrandFixtureConnectorEnabled,
  isRequiredForApproval,
  refusingWebsiteConnector,
  type WebsiteConnectorPort,
} from '@oma/domain';
import { createLogger } from '@oma/observability';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { runExtractionForScan } from '../brand/extraction.service';
import { createProfileDraftFromScan } from '../brand/profile-draft.service';
import { handleLateScanResult } from '../brand/late-result.service';
import type { IngestionJobPayload } from './ingestion-job-payload';

const log = createLogger('ingestion-processor');

function resolveWebsiteConnector(): WebsiteConnectorPort {
  if (isBrandFixtureConnectorEnabled()) {
    return createFixtureWebsiteConnector();
  }
  return refusingWebsiteConnector;
}

async function reauthz(
  tenantId: string | null | undefined,
  actorUserId: string | null | undefined,
) {
  if (!tenantId || !actorUserId) return true;
  const membership = await getPrisma().membership.findFirst({
    where: { tenantId, userId: actorUserId, status: 'ACTIVE' },
    include: { grants: { where: { revokedAt: null } } },
  });
  if (!membership) return false;
  return membership.grants.some((g) => g.capabilityCode === 'brand.scan.control');
}

/** Never overwrite an API-cancelled scan; returns false when the attempt is no longer active. */
async function advanceScanIfActive(
  prisma: ReturnType<typeof getPrisma>,
  scanId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const result = await prisma.scanAttempt.updateMany({
    where: {
      id: scanId,
      status: { notIn: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'] },
      cancelRequestedAt: null,
    },
    data,
  });
  return result.count > 0;
}

async function markScanCancelled(
  prisma: ReturnType<typeof getPrisma>,
  scanId: string,
  jobRunId: string,
) {
  await prisma.scanAttempt.update({
    where: { id: scanId },
    data: { status: 'CANCELLED', finishedAt: new Date() },
  });
  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: { status: 'CANCELLED', finishedAt: new Date() },
  });
}

export type IngestionProcessorOptions = {
  connector?: WebsiteConnectorPort;
  beforeHandle?: (job: Job<IngestionJobPayload>) => Promise<void>;
};

export function startIngestionProcessor(
  connection: IORedis,
  options: IngestionProcessorOptions = {},
) {
  const connector = options.connector ?? resolveWebsiteConnector();

  return new Worker<IngestionJobPayload>(
    'ingestion',
    async (job) => {
      const prisma = getPrisma();
      const data = job.data;
      const jobRunId = data.job_run_id;
      if (!jobRunId) throw new Error('missing job_run_id');

      const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId } });
      if (!jobRun) throw new Error(`job_run not found: ${jobRunId}`);
      if (jobRun.status === 'SUCCEEDED') return { ok: true, skipped: true };
      if (jobRun.status === 'DEAD' || jobRun.status === 'CANCELLED') {
        throw new Error(`job_run terminal: ${jobRun.status}`);
      }

      if (data.tenant_id && jobRun.tenantId && data.tenant_id !== jobRun.tenantId) {
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: 'DEAD',
            errorCode: 'TENANT_MISMATCH',
            errorDetail: 'payload tenant_id does not match job_run',
            finishedAt: new Date(),
          },
        });
        throw new Error('tenant mismatch');
      }

      if (options.beforeHandle) await options.beforeHandle(job);

      const ok = await reauthz(jobRun.tenantId, jobRun.actorUserId);
      if (!ok) {
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: 'DEAD',
            errorCode: 'PERMISSION_DENIED',
            errorDetail: 'membership inactive or missing brand.scan.control',
            finishedAt: new Date(),
          },
        });
        await prisma.scanAttempt.update({
          where: { id: data.scan_attempt_id },
          data: { status: 'FAILED', errorCode: 'PERMISSION_DENIED', finishedAt: new Date() },
        });
        throw new Error('worker reauthz failed');
      }

      const scan = await prisma.scanAttempt.findFirst({
        where: {
          id: data.scan_attempt_id,
          tenantId: jobRun.tenantId ?? undefined,
          brandId: data.brand_id,
        },
        include: { websiteSource: true },
      });
      if (!scan) throw new Error('scan_attempt not found or mismatched');

      if (scan.cancelRequestedAt || scan.status === 'CANCELLED') {
        await markScanCancelled(prisma, scan.id, jobRun.id);
        return { ok: true, cancelled: true };
      }

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      if (
        !(await advanceScanIfActive(prisma, scan.id, {
          status: 'CRAWLING',
          startedAt: new Date(),
          progressPercent: 5,
          // Recorded on the attempt that used it: the API process can be
          // reconfigured later and must not restate this scan's provenance.
          connectorMode: isBrandFixtureConnectorEnabled() ? 'FIXTURE' : 'NOT_CONFIGURED',
        }))
      ) {
        await markScanCancelled(prisma, scan.id, jobRun.id);
        return { ok: true, cancelled: true };
      }

      const brand = await prisma.brandWorkspace.findFirst({ where: { id: scan.brandId } });
      if (brand?.currentApprovedProfileVersionId) {
        const late = await handleLateScanResult({
          tenantId: scan.tenantId,
          brandId: scan.brandId,
          scanAttemptId: scan.id,
          coverageSnapshot: {},
        });
        if (late.action === 'late_draft_created') {
          log.info({ scanId: scan.id }, 'late result handled with new draft');
        }
      }

      if (
        !(await advanceScanIfActive(prisma, scan.id, { status: 'EXTRACTING', progressPercent: 30 }))
      ) {
        await markScanCancelled(prisma, scan.id, jobRun.id);
        return { ok: true, cancelled: true };
      }

      const stillAuthorized = await reauthz(jobRun.tenantId, jobRun.actorUserId);
      if (!stillAuthorized) {
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: 'DEAD',
            errorCode: 'PERMISSION_DENIED',
            errorDetail: 'membership inactive or missing brand.scan.control',
            finishedAt: new Date(),
          },
        });
        await prisma.scanAttempt.update({
          where: { id: scan.id },
          data: { status: 'FAILED', errorCode: 'PERMISSION_DENIED', finishedAt: new Date() },
        });
        throw new Error('worker reauthz failed mid-scan');
      }

      const counts = await runExtractionForScan({
        tenantId: scan.tenantId,
        brandId: scan.brandId,
        scanAttemptId: scan.id,
        startUrl: scan.websiteSource.normalizedUrl,
        connector,
        config: data.config,
      });

      const observations = await prisma.extractedObservation.findMany({
        where: { scanAttemptId: scan.id },
      });
      const requiredPresent = observations.some(
        (o) => isRequiredForApproval(o.fieldKey) && !o.isUnknown,
      );
      const hasEvidence = observations.some((o) => o.evidenceId);
      const usable = requiredPresent && hasEvidence;

      const coverage = {
        pages_fetched: counts.pagesFetched,
        pages_failed: counts.pagesFailed,
        pages_skipped: counts.pagesSkipped,
        required_missing: usable
          ? []
          : observations
              .filter((o) => isRequiredForApproval(o.fieldKey) && o.isUnknown)
              .map((o) => o.fieldKey),
        unknown_fields: observations.filter((o) => o.isUnknown).map((o) => o.fieldKey),
        ai_availability: 'NOT_CONFIGURED',
      };

      const authorizedBeforeComplete = await reauthz(jobRun.tenantId, jobRun.actorUserId);
      if (!authorizedBeforeComplete) {
        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: 'DEAD',
            errorCode: 'PERMISSION_DENIED',
            errorDetail: 'membership inactive or missing brand.scan.control',
            finishedAt: new Date(),
          },
        });
        await prisma.scanAttempt.update({
          where: { id: scan.id },
          data: { status: 'FAILED', errorCode: 'PERMISSION_DENIED', finishedAt: new Date() },
        });
        throw new Error('worker reauthz failed before completion');
      }

      const beforeComplete = await prisma.scanAttempt.findUnique({ where: { id: scan.id } });
      if (beforeComplete?.cancelRequestedAt || beforeComplete?.status === 'CANCELLED') {
        await markScanCancelled(prisma, scan.id, jobRun.id);
        return { ok: true, cancelled: true };
      }

      const finalStatus = usable ? 'PARTIAL' : counts.pagesFetched > 0 ? 'PARTIAL' : 'FAILED';
      const aiAvailability = 'NOT_CONFIGURED';

      if (
        !(await advanceScanIfActive(prisma, scan.id, {
          status: finalStatus,
          progressPercent: 100,
          pagesFetched: counts.pagesFetched,
          pagesFailed: counts.pagesFailed,
          pagesSkipped: counts.pagesSkipped,
          coverageJson: JSON.stringify(coverage),
          aiAvailability,
          finishedAt: new Date(),
        }))
      ) {
        await markScanCancelled(prisma, scan.id, jobRun.id);
        return { ok: true, cancelled: true };
      }

      if (usable || counts.pagesFetched > 0) {
        await createProfileDraftFromScan({
          tenantId: scan.tenantId,
          brandId: scan.brandId,
          scanAttemptId: scan.id,
          aiAvailability,
          coverageSnapshot: coverage,
        });
        await prisma.brandWorkspace.update({
          where: { id: scan.brandId },
          data: { status: brand?.status === 'READY_TO_SCAN' ? 'ACTIVE' : brand?.status },
        });
      }

      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: { status: finalStatus === 'FAILED' ? 'FAILED' : 'SUCCEEDED', finishedAt: new Date() },
      });

      return { ok: true, status: finalStatus, job_run_id: jobRun.id };
    },
    { connection, prefix: process.env.BULLMQ_PREFIX || 'oma', concurrency: 1 },
  );
}
