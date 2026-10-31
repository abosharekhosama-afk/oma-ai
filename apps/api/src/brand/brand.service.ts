import { Injectable } from '@nestjs/common';
import { getPrisma, tenantWhere } from '@oma/db';
import { DomainError, isTerminalScanStatus, newId } from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { brandConnectorMode } from './connector-mode';
import { parseBrandName, type BrandSettingsInput } from './brand-input';
import { DEFAULT_SCHEDULE_TZ } from '../common/schedule-timezone';
import { isValidTimezone } from '../common/zoned-time';

type Tx = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0];

export async function brandTimezone(tenantId: string, brandId: string): Promise<string> {
  const p = await getPrisma().contentPreferences.findFirst({
    where: { tenantId, brandId },
    select: { defaultTimezone: true },
  });
  return isValidTimezone(p?.defaultTimezone) ? p!.defaultTimezone : DEFAULT_SCHEDULE_TZ;
}

/**
 * Pending = scheduled but not yet published. Returned to Approved (if approved) or Draft so
 * nothing publishes from an archived brand.
 */
export async function unschedulePendingPosts(tx: Tx, tenantId: string, brandId: string) {
  const base = {
    tenantId,
    brandId,
    scheduleState: 'SCHEDULED' as const,
    publishState: { not: 'ALL_SUCCEEDED' as const },
  };
  const reset = {
    scheduleState: 'UNSCHEDULED' as const,
    scheduledAt: null,
    publishState: 'NONE' as const,
    nextPublishAt: null,
  };
  const a = await tx.contentItem.updateMany({
    where: { ...base, approvalState: 'APPROVED' },
    data: { ...reset, status: 'APPROVED' },
  });
  const b = await tx.contentItem.updateMany({
    where: { ...base, approvalState: { not: 'APPROVED' } },
    data: { ...reset, status: 'DRAFT' },
  });
  return a.count + b.count;
}

@Injectable()
export class BrandService {
  constructor(private readonly audit: AuditService) {}

  async list(
    tenantId: string,
    query: { cursor?: string; limit?: number; status?: string; q?: string },
  ) {
    const limit = Math.min(query.limit ?? 25, 100);
    const where = tenantWhere(tenantId, {
      deletedAt: null,
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
    const brandIds = data.map((b) => b.id);
    const sources = await getPrisma().websiteSource.findMany({
      where: { brandId: { in: brandIds }, replacedAt: null },
    });
    const sourceByBrand = new Map(sources.map((s) => [s.brandId, s]));
    const prefs = brandIds.length
      ? await getPrisma().contentPreferences.findMany({
          where: { tenantId, brandId: { in: brandIds } },
          select: { brandId: true, defaultTimezone: true },
        })
      : [];
    const tzByBrand = new Map(prefs.map((p) => [p.brandId, p.defaultTimezone]));
    const latestScans = brandIds.length
      ? await getPrisma().scanAttempt.findMany({
          where: { tenantId, brandId: { in: brandIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const scanByBrand = new Map<string, (typeof latestScans)[number]>();
    for (const scan of latestScans) {
      if (!scanByBrand.has(scan.brandId)) scanByBrand.set(scan.brandId, scan);
    }
    const latestProfiles = brandIds.length
      ? await getPrisma().profileVersion.findMany({
          where: { tenantId, brandId: { in: brandIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const profileByBrand = new Map<string, (typeof latestProfiles)[number]>();
    for (const profile of latestProfiles) {
      if (!profileByBrand.has(profile.brandId)) profileByBrand.set(profile.brandId, profile);
    }
    return {
      data: data.map((b) => {
        const scan = scanByBrand.get(b.id);
        const profile = profileByBrand.get(b.id);
        return {
          id: b.id,
          name: b.name,
          status: b.status,
          logo_url: b.logoUrl,
          timezone: tzByBrand.get(b.id) ?? DEFAULT_SCHEDULE_TZ,
          archived_at: b.archivedAt?.toISOString() ?? null,
          primary_website_url: sourceByBrand.get(b.id)?.normalizedUrl ?? null,
          current_approved_profile_version_id: b.currentApprovedProfileVersionId,
          latest_scan_status: scan?.status ?? null,
          latest_scan_id: scan?.id ?? null,
          latest_profile_status: profile?.status ?? null,
          latest_profile_version_id: profile?.id ?? null,
          updated_at: b.updatedAt.toISOString(),
        };
      }),
      page: { next_cursor: hasMore ? (data[data.length - 1]?.id ?? null) : null, limit },
    };
  }

  async create(
    tenantId: string,
    actorUserId: string,
    input: { name: string },
    correlationId?: string,
  ) {
    const name = parseBrandName((input as { name?: unknown } | null)?.name);
    const prisma = getPrisma();
    const ws = await prisma.workspaceSetting.findFirst({
      where: { tenantId },
      select: { timezone: true },
    });
    const timezone = isValidTimezone(ws?.timezone) ? ws!.timezone : DEFAULT_SCHEDULE_TZ;
    const brand = await prisma.$transaction(async (tx) => {
      const created = await tx.brandWorkspace.create({
        data: { id: newId(), tenantId, name, status: 'DRAFT' },
      });
      // Brand timezone lives only in ContentPreferences.defaultTimezone.
      await tx.contentPreferences.create({
        data: { brandId: created.id, tenantId, defaultTimezone: timezone },
      });
      // The creator manages the brand they created.
      await tx.brandMember.create({
        data: {
          id: newId(),
          tenantId,
          brandId: created.id,
          userId: actorUserId,
          role: 'MANAGER',
          addedBy: actorUserId,
        },
      });
      return created;
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
      where: tenantWhere(tenantId, { id: brandId, deletedAt: null }),
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
        logo_url: brand.logoUrl,
        logo_asset_id: brand.logoAssetId,
        timezone: await brandTimezone(tenantId, brand.id),
        updated_at: brand.updatedAt.toISOString(),
      },
    };
  }

  async patch(
    tenantId: string,
    actorUserId: string,
    brandId: string,
    input: BrandSettingsInput,
    correlationId?: string,
  ) {
    const prisma = getPrisma();
    const brand = await prisma.brandWorkspace.findFirst({
      where: tenantWhere(tenantId, { id: brandId, deletedAt: null }),
    });
    if (!brand) throw new DomainError('NOT_FOUND', 'Not found', 404, 'errors.not_found');
    if (brand.status === 'ARCHIVED') {
      throw new DomainError('BRAND_ARCHIVED', 'Brand archived', 409, 'errors.brand_archived');
    }
    if (brand.version !== input.version) {
      throw new DomainError('CONFLICT_VERSION', 'Stale version', 409, 'errors.conflict_version');
    }
    let logo: { logoUrl: string | null; logoAssetId: string | null } | undefined;
    if (input.logoAssetId) {
      const asset = await prisma.mediaAsset.findFirst({
        where: tenantWhere(tenantId, { id: input.logoAssetId, brandId, kind: 'logos' }),
        select: { id: true },
      });
      if (!asset) throw new DomainError('NOT_FOUND', 'Logo not found', 404, 'errors.not_found');
      logo = { logoAssetId: asset.id, logoUrl: `/api/v1/media/${asset.id}/view` };
    } else if (input.logoAssetId === null || input.logoUrl !== undefined) {
      logo = { logoAssetId: null, logoUrl: input.logoUrl ?? null };
    }
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.brandWorkspace.update({
        where: { id: brandId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(logo ?? {}),
          version: { increment: 1 },
        },
      });
      if (input.timezone) {
        await tx.contentPreferences.upsert({
          where: { brandId },
          create: { brandId, tenantId, defaultTimezone: input.timezone },
          update: { defaultTimezone: input.timezone },
        });
      }
      return row;
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
        logo_url: updated.logoUrl,
        logo_asset_id: updated.logoAssetId,
        timezone: await brandTimezone(tenantId, brandId),
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

    let unscheduled = 0;
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
      unscheduled = await unschedulePendingPosts(tx, tenantId, brandId);
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
        unscheduled_posts: unscheduled,
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
