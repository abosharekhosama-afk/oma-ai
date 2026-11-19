import { getPrisma } from '@oma/db';
import {
  brandAiAvailabilityAfterScanComplete,
  brandConnectorMode,
  createWebsiteConnector,
  isRequiredForApproval,
  isScanCancelledError,
  SCAN_CANCELLED_MESSAGE,
  type WebsiteConnectorPort,
} from '@oma/domain';
import { createLogger } from '@oma/observability';
import { Worker, type Job } from 'bullmq';
import type IORedis from 'ioredis';
import { runExtractionForScan } from '../brand/extraction.service';
import { shutdownRenderedFetchBrowser } from '../brand/rendered-page-fetch';
import { createProfileDraftFromScan } from '../brand/profile-draft.service';
import { enqueueBrandAnalysis } from '@oma/db';
import { handleLateScanResult } from '../brand/late-result.service';
import type { IngestionJobPayload } from './ingestion-job-payload';

const log = createLogger('ingestion-processor');

function resolveWebsiteConnector(): WebsiteConnectorPort {
  return createWebsiteConnector();
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

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
}

/**
 * A rejected BullMQ job used to leave the scan in EXTRACTING forever. Only
 * finalize on the last attempt: transient failures must still be retried by
 * BullMQ, while an exhausted job must become visible and retryable in OMA.
 */
async function markIngestionFailed(
  prisma: ReturnType<typeof getPrisma>,
  scanId: string,
  jobRunId: string,
  error: unknown,
) {
  const detail = errorDetails(error).slice(0, 4000);
  await prisma.$transaction([
    prisma.scanAttempt.updateMany({
      where: {
        id: scanId,
        status: { notIn: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'] },
      },
      data: {
        status: 'FAILED',
        errorCode: 'INGESTION_WORKER_FAILED',
        errorDetail: detail,
        finishedAt: new Date(),
      },
    }),
    prisma.jobRun.updateMany({
      where: { id: jobRunId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: 'FAILED',
        errorCode: 'INGESTION_WORKER_FAILED',
        errorDetail: detail,
        finishedAt: new Date(),
      },
    }),
  ]);
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
      try {
        if (!jobRunId) throw new Error('missing job_run_id');

        const jobRun = await prisma.jobRun.findUnique({ where: { id: jobRunId } });
        if (!jobRun) throw new Error(`job_run not found: ${jobRunId}`);
        if (jobRun.status === 'SUCCEEDED') return { ok: true, skipped: true };
        if (jobRun.status === 'CANCELLED') {
          return { ok: true, cancelled: true };
        }
        if (jobRun.status === 'DEAD') {
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
            progressPercent: 2,
            // Recorded on the attempt that used it: the API process can be
            // reconfigured later and must not restate this scan's provenance.
            connectorMode: brandConnectorMode(),
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

        let lastProgressWrite = 0;
        let lastProgressPercent = -1;
        let cancelLatch = false;
        let lastAbortProbe = 0;
        const shouldAbort = async () => {
          if (cancelLatch) return true;
          const now = Date.now();
          if (now - lastAbortProbe < 400) return false;
          lastAbortProbe = now;
          const [attempt, run] = await Promise.all([
            prisma.scanAttempt.findUnique({
              where: { id: scan.id },
              select: { status: true, cancelRequestedAt: true },
            }),
            prisma.jobRun.findUnique({
              where: { id: jobRun.id },
              select: { status: true },
            }),
          ]);
          cancelLatch =
            attempt?.status === 'CANCELLED' ||
            attempt?.cancelRequestedAt != null ||
            run?.status === 'CANCELLED';
          return cancelLatch;
        };
        const reportScanProgress = async (patch: {
          progressPercent: number;
          status?: 'CRAWLING' | 'EXTRACTING';
          pagesFetched?: number;
          pagesFailed?: number;
          pagesSkipped?: number;
        }) => {
          const now = Date.now();
          const statusChange = patch.status !== undefined;
          const bigJump = patch.progressPercent - lastProgressPercent >= 2;
          if (
            !statusChange &&
            !bigJump &&
            now - lastProgressWrite < 1200 &&
            patch.pagesFetched === undefined
          ) {
            return;
          }
          lastProgressWrite = now;
          lastProgressPercent = patch.progressPercent;
          const active = await advanceScanIfActive(prisma, scan.id, {
            ...(patch.status ? { status: patch.status } : {}),
            progressPercent: patch.progressPercent,
            ...(patch.pagesFetched !== undefined ? { pagesFetched: patch.pagesFetched } : {}),
            ...(patch.pagesFailed !== undefined ? { pagesFailed: patch.pagesFailed } : {}),
            ...(patch.pagesSkipped !== undefined ? { pagesSkipped: patch.pagesSkipped } : {}),
          });
          if (!active) {
            throw new Error(SCAN_CANCELLED_MESSAGE);
          }
        };

        let counts;
        try {
          counts = await runExtractionForScan({
            tenantId: scan.tenantId,
            brandId: scan.brandId,
            scanAttemptId: scan.id,
            startUrl: scan.websiteSource.normalizedUrl,
            connector,
            config: data.config,
            onProgress: reportScanProgress,
            shouldAbort,
          });
        } catch (err) {
          if (isScanCancelledError(err)) {
            await markScanCancelled(prisma, scan.id, jobRun.id);
            return { ok: true, cancelled: true };
          }
          throw err;
        }

        const observations = await prisma.extractedObservation.findMany({
          where: { scanAttemptId: scan.id },
        });
        const requiredPresent = observations.some(
          (o) => isRequiredForApproval(o.fieldKey) && !o.isUnknown,
        );
        const hasEvidence = observations.some((o) => o.evidenceId);
        const usable = requiredPresent && hasEvidence;

        const [pagesDiscovered, productsDiscovered, servicesDiscovered] = await Promise.all([
          prisma.discoveredPage.count({ where: { scanAttemptId: scan.id } }),
          prisma.discoveredProductService.count({
            where: { scanAttemptId: scan.id, kind: 'PRODUCT' },
          }),
          prisma.discoveredProductService.count({
            where: { scanAttemptId: scan.id, kind: 'SERVICE' },
          }),
        ]);

        const coverage = {
          pages_fetched: counts.pagesFetched,
          pages_failed: counts.pagesFailed,
          pages_skipped: counts.pagesSkipped,
          scan_max_pages: data.config?.max_pages ?? Number(process.env.BRAND_MAX_PAGES ?? 50),
          pages_discovered: pagesDiscovered,
          products_discovered: productsDiscovered,
          services_discovered: servicesDiscovered,
          pages_js_rendered: counts.pagesJsRendered ?? 0,
          pages_js_render_attempted: counts.pagesJsRenderAttempted ?? 0,
          pages_js_render_failed: counts.pagesJsRenderFailed ?? 0,
          js_render_errors: counts.jsRenderErrors ?? [],
          js_render_error_details: counts.jsRenderErrorDetails ?? [],
          js_render_launch_detail: counts.jsRenderLaunchDetail ?? null,
          js_render_mode: counts.jsRenderMode ?? 'off',
          catalog_platform: counts.catalog?.platform ?? null,
          catalog_platform_products: counts.catalog?.platformProducts ?? 0,
          catalog_platform_error: counts.catalog?.platformError ?? null,
          products_with_media: counts.catalog?.productsWithMedia ?? 0,
          product_media_imported: counts.catalog?.productMediaImported ?? 0,
          products_persisted: counts.catalog?.productsPersisted ?? 0,
          js_render_adopted: counts.pagesJsRendered ?? 0,
          stop_reason: counts.stopReason ?? 'queue_empty',
          required_missing: usable
            ? []
            : observations
                .filter((o) => isRequiredForApproval(o.fieldKey) && o.isUnknown)
                .map((o) => o.fieldKey),
          unknown_fields: observations.filter((o) => o.isUnknown).map((o) => o.fieldKey),
          ai_availability: brandAiAvailabilityAfterScanComplete(),
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
        const aiAvailability = brandAiAvailabilityAfterScanComplete();

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
          const profileVersionId = await createProfileDraftFromScan({
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
          if (scan.tenantId) {
            await enqueueBrandAnalysis({
              tenantId: scan.tenantId,
              brandId: scan.brandId,
              scanAttemptId: scan.id,
              profileVersionId,
              actorUserId: jobRun.actorUserId ?? scan.actorUserId,
              correlationId: jobRun.correlationId,
            });
          }
        }

        await prisma.jobRun.update({
          where: { id: jobRun.id },
          data: {
            status: finalStatus === 'FAILED' ? 'FAILED' : 'SUCCEEDED',
            finishedAt: new Date(),
          },
        });

        return { ok: true, status: finalStatus, job_run_id: jobRun.id };
      } catch (error) {
        if (isScanCancelledError(error)) {
          if (jobRunId && data.scan_attempt_id) {
            await markScanCancelled(prisma, data.scan_attempt_id, jobRunId).catch(() => undefined);
          }
          return { ok: true, cancelled: true };
        }
        const attempts = Number(job.opts.attempts ?? 1);
        const finalAttempt = job.attemptsMade + 1 >= attempts;
        if (finalAttempt && jobRunId && data.scan_attempt_id) {
          try {
            await markIngestionFailed(prisma, data.scan_attempt_id, jobRunId, error);
          } catch (finalizationError) {
            log.error(
              { err: finalizationError, scanId: data.scan_attempt_id, jobRunId },
              'failed to finalize ingestion failure',
            );
          }
        }
        throw error;
      } finally {
        await shutdownRenderedFetchBrowser().catch(() => undefined);
      }
    },
    { connection, prefix: process.env.BULLMQ_PREFIX || 'oma', concurrency: 1 },
  );
}
