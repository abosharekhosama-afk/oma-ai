import { Injectable } from '@nestjs/common';
import { enqueueBrandAnalysis, getPrisma, tenantWhere, writeOutbox } from '@oma/db';
import {
  DomainError,
  canRetryScan,
  catalogOfferingsFromDiscoveryRows,
  estimateCatalogContentRequests,
  isTerminalScanStatus,
  newId,
} from '@oma/domain';
import { billingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { BrandService } from './brand.service';

type ScanConfig = {
  max_pages?: number;
  max_depth?: number;
  max_duration_seconds?: number;
};

@Injectable()
export class ScanService {
  constructor(
    private readonly audit: AuditService,
    private readonly brands: BrandService,
  ) {}

  private clampConfig(config?: ScanConfig) {
    const maxPages = Math.min(config?.max_pages ?? Number(process.env.BRAND_MAX_PAGES ?? 50), 100);
    const maxDepth = Math.min(config?.max_depth ?? Number(process.env.BRAND_MAX_DEPTH ?? 3), 5);
    const maxDuration = Math.min(
      config?.max_duration_seconds ?? Number(process.env.BRAND_MAX_DURATION_SECONDS ?? 600),
      1200,
    );
    return { max_pages: maxPages, max_depth: maxDepth, max_duration_seconds: maxDuration };
  }

  private serializeScan(scan: {
    id: string;
    status: string;
    progressPercent: number;
    pagesFetched: number;
    pagesFailed: number;
    pagesSkipped: number;
    aiAvailability: string;
    analysisStatus?: string;
    analysisErrorCode?: string | null;
    connectorMode: string;
    coverageJson: string | null;
    jobRunId: string;
    errorCode: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  }) {
    return {
      id: scan.id,
      status: scan.status,
      progress_percent: scan.progressPercent,
      pages_fetched: scan.pagesFetched,
      pages_failed: scan.pagesFailed,
      pages_skipped: scan.pagesSkipped,
      ai_availability: scan.aiAvailability,
      analysis_status: scan.analysisStatus ?? 'NOT_REQUESTED',
      analysis_error_code: scan.analysisErrorCode ?? null,
      connector_mode: scan.connectorMode,
      coverage: scan.coverageJson ? JSON.parse(scan.coverageJson) : null,
      job_run_id: scan.jobRunId,
      error_code: scan.errorCode,
      started_at: scan.startedAt?.toISOString() ?? null,
      finished_at: scan.finishedAt?.toISOString() ?? null,
    };
  }

  async start(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: { trigger?: string; config?: ScanConfig },
    idempotencyKey: string,
    correlationId?: string,
  ) {
    await this.brands.assertBrandMutable(tenantId, brandId);
    const active = await this.brands.getActiveScanCount(tenantId, brandId);
    if (active > 0) {
      throw new DomainError('CONFLICT_STATE', 'Scan in progress', 409, 'errors.conflict_state');
    }

    const brand = await getPrisma().brandWorkspace.findFirstOrThrow({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand.primaryWebsiteSourceId) {
      throw new DomainError(
        'WEBSITE_NOT_CONNECTED',
        'No website connected',
        409,
        'errors.website_not_connected',
      );
    }
    const source = await getPrisma().websiteSource.findFirst({
      where: tenantWhere(tenantId, {
        id: brand.primaryWebsiteSourceId,
        validationStatus: 'VALID',
        replacedAt: null,
      }),
    });
    if (!source) {
      throw new DomainError(
        'WEBSITE_NOT_CONNECTED',
        'No valid website source',
        409,
        'errors.website_not_connected',
      );
    }

    const config = this.clampConfig(input.config);
    const jobRunId = newId();
    const scanId = newId();

    const result = await getPrisma().$transaction(async (tx) => {
      await tx.jobRun.create({
        data: {
          id: jobRunId,
          tenantId,
          queue: 'ingestion',
          jobType: 'ingestion.scan',
          status: 'QUEUED',
          payloadJson: JSON.stringify({ scan_attempt_id: scanId, brand_id: brandId, config }),
          actorUserId,
          correlationId,
          idempotencyKey,
        },
      });
      const scan = await tx.scanAttempt.create({
        data: {
          id: scanId,
          tenantId,
          brandId,
          websiteSourceId: source.id,
          status: 'QUEUED',
          trigger: (input.trigger as 'START' | 'RETRY' | 'RESCAN') ?? 'START',
          jobRunId,
          idempotencyKey,
          actorUserId,
          correlationId,
          aiAvailability: 'NOT_CONFIGURED',
        },
      });
      await writeOutbox(tx, {
        tenantId,
        eventType: 'ingestion.scan.started',
        payload: {
          jobRunId,
          scanAttemptId: scanId,
          tenantId,
          brandId,
          actorUserId,
          correlationId,
          idempotencyKey,
          config,
        },
      });
      return scan;
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.scan.started',
      targetType: 'ScanAttempt',
      targetId: result.id,
      correlationId,
    });

    return {
      data: {
        scan_attempt_id: result.id,
        job_run_id: result.jobRunId,
        status: result.status,
        progress_percent: result.progressPercent,
        ai_availability: result.aiAvailability,
      },
    };
  }

  async get(tenantId: string, brandId: string, scanId: string) {
    const scan = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { id: scanId, brandId }),
    });
    if (!scan) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    const profile = await getPrisma().profileVersion.findFirst({
      where: tenantWhere(tenantId, { scanAttemptId: scanId }),
      orderBy: { createdAt: 'desc' },
    });
    const [pagesDiscovered, productsDiscovered, servicesDiscovered, catalogRows] =
      await Promise.all([
        getPrisma().discoveredPage.count({ where: tenantWhere(tenantId, { scanAttemptId: scanId }) }),
        getPrisma().discoveredProductService.count({
          where: tenantWhere(tenantId, { scanAttemptId: scanId, kind: 'PRODUCT' }),
        }),
        getPrisma().discoveredProductService.count({
          where: tenantWhere(tenantId, { scanAttemptId: scanId, kind: 'SERVICE' }),
        }),
        getPrisma().discoveredProductService.findMany({
          where: tenantWhere(tenantId, { scanAttemptId: scanId }),
          orderBy: { name: 'asc' },
        }),
      ]);
    const catalogOfferings = catalogOfferingsFromDiscoveryRows(catalogRows);
    return {
      data: {
        ...this.serializeScan(scan),
        profile_version_id: profile?.id ?? null,
        discovery_summary: {
          pages: pagesDiscovered,
          products: productsDiscovered,
          services: servicesDiscovered,
        },
        content_outlook: {
          catalog_items: catalogOfferings.length,
          product_names: catalogOfferings
            .filter((item) => item.kind === 'product')
            .slice(0, 12)
            .map((item) => item.name),
          service_names: catalogOfferings
            .filter((item) => item.kind === 'service')
            .slice(0, 8)
            .map((item) => item.name),
          estimated_organic_requests: estimateCatalogContentRequests(catalogOfferings, {
            organicEnabled: true,
            paidEnabled: false,
          }),
          estimated_paid_requests: estimateCatalogContentRequests(catalogOfferings, {
            organicEnabled: false,
            paidEnabled: true,
          }),
        },
      },
    };
  }

  async list(
    tenantId: string,
    brandId: string,
    query: { cursor?: string; limit?: number; status?: string },
  ) {
    const limit = Math.min(query.limit ?? 25, 100);
    const rows = await getPrisma().scanAttempt.findMany({
      where: tenantWhere(tenantId, {
        brandId,
        ...(query.status ? { status: query.status as never } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      }),
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: data.map((s) => this.serializeScan(s)),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  async cancel(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    scanId: string,
    correlationId?: string,
  ) {
    const scan = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { id: scanId, brandId }),
    });
    if (!scan) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (isTerminalScanStatus(scan.status as never)) {
      return { data: this.serializeScan(scan) };
    }
    const updated = await getPrisma().$transaction(async (tx) => {
      const s = await tx.scanAttempt.update({
        where: { id: scanId },
        data: {
          cancelRequestedAt: new Date(),
          status: 'CANCELLED',
          finishedAt: new Date(),
        },
      });
      await tx.jobRun.updateMany({
        where: { id: scan.jobRunId, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: 'CANCELLED', finishedAt: new Date() },
      });
      return s;
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.scan.cancelled',
      targetType: 'ScanAttempt',
      targetId: scanId,
      correlationId,
    });
    return { data: this.serializeScan(updated) };
  }

  async retry(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    scanId: string,
    input: { config?: ScanConfig },
    idempotencyKey: string,
    correlationId?: string,
  ) {
    const parent = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { id: scanId, brandId }),
    });
    if (!parent) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (!canRetryScan(parent.status as never)) {
      throw new DomainError('CONFLICT_STATE', 'Cannot retry scan', 409, 'errors.conflict_state');
    }
    const active = await this.brands.getActiveScanCount(tenantId, brandId);
    if (active > 0) {
      throw new DomainError('CONFLICT_STATE', 'Scan in progress', 409, 'errors.conflict_state');
    }

    const config = this.clampConfig(input.config);
    const jobRunId = newId();
    const newScanId = newId();

    const scan = await getPrisma().$transaction(async (tx) => {
      await tx.jobRun.create({
        data: {
          id: jobRunId,
          tenantId,
          queue: 'ingestion',
          jobType: 'ingestion.scan',
          status: 'QUEUED',
          payloadJson: JSON.stringify({
            scan_attempt_id: newScanId,
            brand_id: brandId,
            parent_attempt_id: scanId,
            config,
          }),
          actorUserId,
          correlationId,
          idempotencyKey,
        },
      });
      const created = await tx.scanAttempt.create({
        data: {
          id: newScanId,
          tenantId,
          brandId,
          websiteSourceId: parent.websiteSourceId,
          status: 'QUEUED',
          trigger: 'RETRY',
          parentAttemptId: scanId,
          jobRunId,
          idempotencyKey,
          actorUserId,
          correlationId,
          aiAvailability: 'NOT_CONFIGURED',
        },
      });
      await writeOutbox(tx, {
        tenantId,
        eventType: 'ingestion.scan.started',
        payload: {
          jobRunId,
          scanAttemptId: newScanId,
          tenantId,
          brandId,
          actorUserId,
          correlationId,
          idempotencyKey,
          config,
        },
      });
      return created;
    });

    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.scan.retried',
      targetType: 'ScanAttempt',
      targetId: newScanId,
      beforeRef: scanId,
      correlationId,
    });

    return {
      data: {
        scan_attempt_id: scan.id,
        job_run_id: scan.jobRunId,
        status: scan.status,
        progress_percent: scan.progressPercent,
        ai_availability: scan.aiAvailability,
      },
    };
  }

  async requestAnalysis(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    scanId: string,
    idempotencyKey: string,
    correlationId?: string,
  ) {
    await billingService.assertFeature(tenantId, 'ai_assist');
    await this.brands.assertBrandMutable(tenantId, brandId);
    const scan = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { id: scanId, brandId }),
    });
    if (!scan) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (!['SUCCEEDED', 'PARTIAL'].includes(scan.status)) {
      throw new DomainError(
        'CONFLICT_STATE',
        'AI analysis can only be run on a completed scan',
        409,
        'errors.conflict_state',
      );
    }
    const profile = await getPrisma().profileVersion.findFirst({
      where: tenantWhere(tenantId, { scanAttemptId: scanId }),
      orderBy: { createdAt: 'desc' },
    });
    if (!profile) {
      throw new DomainError(
        'CONFLICT_STATE',
        'No profile draft exists for this scan',
        409,
        'errors.conflict_state',
      );
    }
    if (profile.status === 'APPROVED' || profile.status === 'SUPERSEDED') {
      throw new DomainError(
        'APPROVED_VERSION_IMMUTABLE',
        'Approved versions cannot be modified by AI.',
        409,
        'errors.approved_immutable',
      );
    }
    const result = await enqueueBrandAnalysis({
      tenantId,
      brandId,
      scanAttemptId: scanId,
      profileVersionId: profile.id,
      actorUserId,
      correlationId,
      idempotencyKey,
    });
    if (!result.queued && result.reason === 'NOT_CONFIGURED') {
      throw new DomainError(
        'AI_NOT_CONFIGURED',
        'AI is not configured. Continue manually.',
        503,
        'errors.ai_not_configured',
        [{ manual_journey: true }],
      );
    }
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.scan.analysis_requested',
      targetType: 'ScanAttempt',
      targetId: scanId,
      correlationId,
    });
    const updated = await getPrisma().scanAttempt.findFirstOrThrow({
      where: tenantWhere(tenantId, { id: scanId, brandId }),
    });
    return {
      data: {
        ...this.serializeScan(updated),
        profile_version_id: profile.id,
        job_run_id: result.jobRunId ?? updated.jobRunId,
        queued: result.queued,
      },
    };
  }
}
