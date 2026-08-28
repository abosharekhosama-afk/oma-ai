import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, isTerminalScanStatus, newId } from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { brandConnectorMode } from './connector-mode';

@Injectable()
export class BrandService {
  constructor(private readonly audit: AuditService) {}

  async list(
    tenantId: string,
    query: { cursor?: string; limit?: number; status?: string; q?: string },
  ) {
    const limit = Math.min(query.limit ?? 25, 100);
    const where = tenantWhere(tenantId, {
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    });
    const rows = await getPrisma().brandWorkspace.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const sources = await getPrisma().websiteSource.findMany({
      where: { brandId: { in: data.map((b) => b.id) }, replacedAt: null },
    });
    const sourceByBrand = new Map(sources.map((s) => [s.brandId, s]));
    return {
      data: data.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        primary_website_url: sourceByBrand.get(b.id)?.normalizedUrl ?? null,
        current_approved_profile_version_id: b.currentApprovedProfileVersionId,
        updated_at: b.updatedAt.toISOString(),
      })),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  async create(
    tenantId: string,
    actorUserId: string,
    input: { name: string },
    correlationId?: string,
  ) {
    const name = input.name.trim();
    if (!name || name.length > 120) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid name', 400, 'errors.validation_failed');
    }
    const brand = await getPrisma().brandWorkspace.create({
      data: { id: newId(), tenantId, name, status: 'DRAFT' },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.created',
      targetType: 'BrandWorkspace',
      targetId: brand.id,
      correlationId,
    });
    return {
      data: {
        id: brand.id,
        name: brand.name,
        status: brand.status,
        version: brand.version,
        created_at: brand.createdAt.toISOString(),
      },
    };
  }

  async get(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    const source = brand.primaryWebsiteSourceId
      ? await getPrisma().websiteSource.findFirst({
          where: { id: brand.primaryWebsiteSourceId, tenantId },
        })
      : null;
    const latestScan = await getPrisma().scanAttempt.findFirst({
      where: tenantWhere(tenantId, { brandId }),
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: {
        id: brand.id,
        name: brand.name,
        status: brand.status,
        version: brand.version,
        current_approved_profile_version_id: brand.currentApprovedProfileVersionId,
        website: source
          ? {
              website_source_id: source.id,
              normalized_url: source.normalizedUrl,
              validation_status: source.validationStatus,
              source_revision: source.sourceRevision,
            }
          : null,
        latest_scan: latestScan
          ? {
              id: latestScan.id,
              status: latestScan.status,
              job_run_id: latestScan.jobRunId,
              connector_mode: latestScan.connectorMode,
            }
          : null,
        // Forward-looking: which connector a scan started now would use. Past
        // scans report the mode stored on their own attempt.
        next_scan_connector_mode: brandConnectorMode(),
        archived_at: brand.archivedAt?.toISOString() ?? null,
        updated_at: brand.updatedAt.toISOString(),
      },
    };
  }

  async patch(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: { name?: string; version: number },
    correlationId?: string,
  ) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (brand.status === 'ARCHIVED') {
      throw new DomainError('BRAND_ARCHIVED', 'Brand archived', 409, 'errors.brand_archived');
    }
    if (brand.version !== input.version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    const updated = await getPrisma().brandWorkspace.update({
      where: { id: brandId },
      data: {
        name: input.name?.trim() ?? brand.name,
        version: { increment: 1 },
      },
    });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.updated',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      correlationId,
    });
    return {
      data: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        version: updated.version,
      },
    };
  }

  async archive(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: { version: number; reason?: string },
    correlationId?: string,
  ) {
    const prisma = getPrisma();
    const brand = await prisma.brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (brand.status === 'ARCHIVED') {
      return {
        data: { id: brand.id, status: 'ARCHIVED', archived_at: brand.archivedAt?.toISOString() },
      };
    }
    if (brand.version !== input.version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }

    await prisma.$transaction(async (tx) => {
      const activeScans = await tx.scanAttempt.findMany({
        where: tenantWhere(tenantId, {
          brandId,
          status: { notIn: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'] },
        }),
      });
      for (const scan of activeScans) {
        await tx.scanAttempt.update({
          where: { id: scan.id },
          data: { cancelRequestedAt: new Date(), status: 'CANCELLED', finishedAt: new Date() },
        });
        await tx.jobRun.updateMany({
          where: { id: scan.jobRunId, status: { in: ['QUEUED', 'RUNNING'] } },
          data: { status: 'CANCELLED', finishedAt: new Date() },
        });
      }
      await tx.brandWorkspace.update({
        where: { id: brandId },
        data: { status: 'ARCHIVED', archivedAt: new Date(), version: { increment: 1 } },
      });
    });

    const archived = await prisma.brandWorkspace.findUniqueOrThrow({ where: { id: brandId } });
    await this.audit.write({
      actorUserId,
      tenantId,
      action: 'brand.archived',
      targetType: 'BrandWorkspace',
      targetId: brandId,
      afterRef: input.reason,
      correlationId,
    });
    return {
      data: {
        id: archived.id,
        status: archived.status,
        archived_at: archived.archivedAt?.toISOString(),
      },
    };
  }

  async assertBrandMutable(tenantId: string, brandId: string) {
    const brand = await getPrisma().brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId }),
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (brand.status === 'ARCHIVED') {
      throw new DomainError('BRAND_ARCHIVED', 'Brand archived', 409, 'errors.brand_archived');
    }
    return brand;
  }

  async getActiveScanCount(tenantId: string, brandId: string) {
    const scans = await getPrisma().scanAttempt.findMany({
      where: tenantWhere(tenantId, { brandId }),
    });
    return scans.filter((s) => !isTerminalScanStatus(s.status as never)).length;
  }
}
