import { Injectable } from '@nestjs/common';
import { getPrisma } from '@oma/db';
import { DomainError, hashSessionToken, newId } from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import type { IdentityService } from '../identity/identity.service';
import { enqueuePublishTargetsNow } from '../social/enqueue-publish-now';

const IMPERSONATION_TTL_MS = 30 * 60 * 1000;
const LOOKUP_MIN = 2;
const LOOKUP_TAKE = 25;

@Injectable()
export class SupportService {
  constructor(
    private readonly audit: AuditService,
    private readonly identity: IdentityService,
  ) {}

  async lookup(input: { q: string; type?: string; tenant_id?: string }) {
    const q = input.q?.trim() ?? '';
    if (q.length < LOOKUP_MIN) {
      throw new DomainError(
        'VALIDATION_FAILED',
        `Query must be at least ${LOOKUP_MIN} characters`,
        400,
        'errors.validation_failed',
      );
    }
    const prisma = getPrisma();
    const type = (input.type ?? 'all').toLowerCase();
    const tenantId = input.tenant_id?.trim();

    const users =
      type === 'all' || type === 'user'
        ? await prisma.user.findMany({
            where: {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { id: q },
              ],
            },
            select: {
              id: true,
              email: true,
              name: true,
              status: true,
              systemRole: true,
            },
            take: LOOKUP_TAKE,
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const tenants =
      type === 'all' || type === 'tenant'
        ? await prisma.tenant.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
                { id: q },
              ],
            },
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              subscription: { select: { planCode: true, status: true } },
            },
            take: LOOKUP_TAKE,
            orderBy: { createdAt: 'desc' },
          })
        : [];

    const brands =
      type === 'all' || type === 'brand'
        ? await prisma.brandWorkspace.findMany({
            where: {
              ...(tenantId ? { tenantId } : {}),
              OR: [{ name: { contains: q, mode: 'insensitive' } }, { id: q }],
            },
            select: {
              id: true,
              tenantId: true,
              name: true,
              status: true,
            },
            take: LOOKUP_TAKE,
            orderBy: { createdAt: 'desc' },
          })
        : [];

    return {
      data: {
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          status: u.status,
          system_role: u.systemRole,
        })),
        tenants: tenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          status: t.status,
          plan_code: t.subscription?.planCode ?? null,
          subscription_status: t.subscription?.status ?? null,
        })),
        brands: brands.map((b) => ({
          id: b.id,
          tenant_id: b.tenantId,
          name: b.name,
          status: b.status,
        })),
      },
    };
  }

  async tenantSocial(tenantId: string) {
    const prisma = getPrisma();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new DomainError('NOT_FOUND', 'Tenant not found', 404, 'errors.not_found');

    const pages = await prisma.socialPage.findMany({
      where: { tenantId },
      select: {
        id: true,
        brandId: true,
        network: true,
        name: true,
        status: true,
        tokenExpiresAt: true,
        refreshExpiresAt: true,
        scopes: true,
        lastError: true,
        lastRefreshedAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    const now = Date.now();
    return {
      data: pages.map((p) => ({
        id: p.id,
        brand_id: p.brandId,
        network: p.network,
        name: p.name,
        status: p.status,
        token_expires_at: p.tokenExpiresAt?.toISOString() ?? null,
        token_expired: p.tokenExpiresAt ? p.tokenExpiresAt.getTime() < now : false,
        refresh_expires_at: p.refreshExpiresAt?.toISOString() ?? null,
        scope_count: p.scopes.length,
        last_error: p.lastError,
        last_refreshed_at: p.lastRefreshedAt?.toISOString() ?? null,
      })),
    };
  }

  async tenantStorage(tenantId: string) {
    const prisma = getPrisma();
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new DomainError('NOT_FOUND', 'Tenant not found', 404, 'errors.not_found');

    const [setting, connection, failedBackups, missingAssets, recentFailedJobs] = await Promise.all(
      [
        prisma.workspaceStorageSetting.findUnique({ where: { tenantId } }),
        prisma.workDriveConnection.findUnique({ where: { tenantId } }),
        prisma.storageBackupJob.count({
          where: {
            tenantId,
            status: 'FAILED',
            updatedAt: { gte: new Date(Date.now() - 7 * 86400_000) },
          },
        }),
        prisma.mediaAsset.count({ where: { tenantId, status: 'MISSING' } }),
        prisma.jobRun.findMany({
          where: {
            tenantId,
            status: 'FAILED',
            queue: { in: ['media', 'social'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            queue: true,
            jobType: true,
            errorCode: true,
            errorDetail: true,
            createdAt: true,
          },
        }),
      ],
    );

    return {
      data: {
        mode: setting?.mode ?? 'OMA_INTERNAL',
        backup_paused_reason: setting?.backupPausedReason ?? null,
        platform_key_status: setting?.platformKeyStatus ?? null,
        byos_connection_status: connection?.status ?? null,
        byos_last_error: connection?.lastError ?? null,
        failed_backup_jobs_7d: failedBackups,
        missing_media_assets: missingAssets,
        recent_failed_worker_jobs: recentFailedJobs.map((j) => ({
          id: j.id,
          queue: j.queue,
          job_type: j.jobType,
          error_code: j.errorCode,
          error_detail: j.errorDetail,
          created_at: j.createdAt.toISOString(),
        })),
      },
    };
  }

  async publishingFailures(input: { tenant_id?: string; limit?: number }) {
    const take = Math.min(50, Math.max(1, input.limit ?? 25));
    const prisma = getPrisma();
    const targets = await prisma.contentPublishTarget.findMany({
      where: {
        publishState: 'FAILED',
        ...(input.tenant_id ? { tenantId: input.tenant_id } : {}),
      },
      include: {
        contentItem: { select: { id: true, titleEn: true, brandId: true } },
        socialPage: { select: { id: true, network: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take,
    });
    return {
      data: targets.map((t) => ({
        id: t.id,
        tenant_id: t.tenantId,
        content_id: t.contentItemId,
        content_title: t.contentItem.titleEn,
        brand_id: t.contentItem.brandId,
        social_page_id: t.socialPageId,
        network: t.socialPage.network,
        page_name: t.socialPage.name,
        publish_attempts: t.publishAttempts,
        last_error: t.lastPublishError,
        updated_at: t.updatedAt.toISOString(),
      })),
    };
  }

  async retryPublishTarget(actorUserId: string, publishTargetId: string, correlationId?: string) {
    const prisma = getPrisma();
    const target = await prisma.contentPublishTarget.findUnique({
      where: { id: publishTargetId },
      select: { id: true, tenantId: true, contentItemId: true, publishState: true },
    });
    if (!target)
      throw new DomainError('NOT_FOUND', 'Publish target not found', 404, 'errors.not_found');

    await prisma.contentPublishTarget.update({
      where: { id: target.id },
      data: {
        publishState: 'QUEUED',
        nextPublishAt: new Date(),
        lastPublishError: null,
      },
    });

    const enqueued = await enqueuePublishTargetsNow(target.contentItemId);

    await this.audit.write({
      actorUserId,
      actorType: 'SUPPORT',
      tenantId: target.tenantId,
      action: 'support.publish.retry',
      targetType: 'ContentPublishTarget',
      targetId: target.id,
      afterRef: JSON.stringify({ enqueued_jobs: enqueued }),
      correlationId,
    });

    return { data: { publish_target_id: target.id, enqueued_jobs: enqueued } };
  }

  async startImpersonation(
    supportUserId: string,
    input: { target_user_id: string; tenant_id: string; reason: string },
    correlationId?: string,
  ) {
    const reason = input.reason?.trim();
    if (!reason || reason.length < 8) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'A detailed reason is required',
        400,
        'errors.validation_failed',
      );
    }
    const prisma = getPrisma();
    const membership = await prisma.membership.findFirst({
      where: {
        tenantId: input.tenant_id,
        userId: input.target_user_id,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!membership) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Target user is not an active member of this workspace',
        400,
        'errors.validation_failed',
      );
    }

    const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_MS);
    const row = await prisma.supportImpersonationSession.create({
      data: {
        id: newId(),
        supportUserId,
        targetUserId: input.target_user_id,
        tenantId: input.tenant_id,
        reason,
        expiresAt,
      },
    });

    await this.audit.write({
      actorUserId: supportUserId,
      actorType: 'SUPPORT',
      tenantId: input.tenant_id,
      action: 'support.impersonation.requested',
      targetType: 'User',
      targetId: input.target_user_id,
      afterRef: JSON.stringify({ impersonation_id: row.id, reason }),
      correlationId,
    });

    return {
      data: {
        impersonation_id: row.id,
        expires_at: expiresAt.toISOString(),
        assume_url: `/api/v1/support/impersonate/${row.id}/assume`,
      },
    };
  }

  async assumeImpersonation(
    supportUserId: string,
    impersonationId: string,
    opts: { ip?: string; userAgent?: string; correlationId?: string },
  ) {
    const prisma = getPrisma();
    const row = await prisma.supportImpersonationSession.findUnique({
      where: { id: impersonationId },
    });
    if (!row || row.supportUserId !== supportUserId) {
      throw new DomainError('NOT_FOUND', 'Impersonation not found', 404, 'errors.not_found');
    }
    if (row.endedAt) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Impersonation ended',
        409,
        'errors.validation_failed',
      );
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Impersonation expired',
        409,
        'errors.validation_failed',
      );
    }

    const { token, session } = await this.identity.createSessionForUser(row.targetUserId, {
      ip: opts.ip,
      userAgent: opts.userAgent,
      auditAction: 'support.impersonation.assumed',
    });

    await prisma.session.update({
      where: { id: session.id },
      data: {
        activeTenantId: row.tenantId,
        expiresAt: row.expiresAt,
      },
    });

    await prisma.supportImpersonationSession.update({
      where: { id: row.id },
      data: { sessionId: session.id, startedAt: new Date() },
    });

    await this.audit.write({
      actorUserId: supportUserId,
      actorType: 'SUPPORT',
      tenantId: row.tenantId,
      action: 'support.impersonation.active',
      targetType: 'Session',
      targetId: session.id,
      afterRef: JSON.stringify({ target_user_id: row.targetUserId }),
      correlationId: opts.correlationId,
    });

    return { token, redirect_path: '/app', tenant_id: row.tenantId };
  }

  async endImpersonation(
    supportUserId: string,
    impersonationId: string,
    reason?: string,
    correlationId?: string,
  ) {
    const prisma = getPrisma();
    const row = await prisma.supportImpersonationSession.findUnique({
      where: { id: impersonationId },
    });
    if (!row || row.supportUserId !== supportUserId) {
      throw new DomainError('NOT_FOUND', 'Impersonation not found', 404, 'errors.not_found');
    }
    if (row.endedAt) return { data: { ended: true } };

    if (row.sessionId) {
      await prisma.session.updateMany({
        where: { id: row.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await prisma.supportImpersonationSession.update({
      where: { id: row.id },
      data: { endedAt: new Date(), endedReason: reason?.trim() || 'ended_by_support' },
    });

    await this.audit.write({
      actorUserId: supportUserId,
      actorType: 'SUPPORT',
      tenantId: row.tenantId,
      action: 'support.impersonation.ended',
      targetType: 'SupportImpersonationSession',
      targetId: row.id,
      correlationId,
    });

    return { data: { ended: true } };
  }

  /** Revoke any active impersonation session tied to the current browser session (best-effort). */
  async endImpersonationBySessionToken(sessionToken: string, endedReason = 'session_logout') {
    const prisma = getPrisma();
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(sessionToken) },
      select: { id: true },
    });
    if (!session) return;
    const row = await prisma.supportImpersonationSession.findFirst({
      where: { sessionId: session.id, endedAt: null },
    });
    if (!row) return;
    await prisma.supportImpersonationSession.update({
      where: { id: row.id },
      data: { endedAt: new Date(), endedReason },
    });
  }
}
