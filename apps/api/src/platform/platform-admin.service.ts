import { Injectable } from '@nestjs/common';
import {
  getPrisma,
  hydratePlan,
  listTenantUsageOverrides,
  loadBillingSettings,
  periodStartOf,
  snapshotUsage,
  upsertTenantUsageOverrides,
} from '@oma/db';
import {
  assertCompanyName,
  DomainError,
  newId,
  normalizePlanCode,
  slugifyCompanyName,
  SYSTEM_PROFILES,
  uniquifySlug,
  workDriveMasterConfig,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import { billingService } from '../billing/billing.service';
import { estimateMrrUsdCents } from './platform-admin-metrics';
import {
  createOrPromoteOperator,
  listPlatformOperators,
  patchPlatformOperator,
} from './platform-admin-operators';
import { listAdminPlans, patchAdminPlan } from './platform-admin-plans';
import {
  probeLiveAi as runProbeLiveAi,
  probeRedis as runProbeRedis,
  probeWebsiteScan as runProbeWebsiteScan,
  systemIntegrationsStatus as buildSystemIntegrationsStatus,
} from './platform-admin-system-probes';
import { isAiLiveEnabled, isAiProviderConfigured } from '@oma/domain';
import { configuredAiProvider } from '@oma/ai';

function secretConfigured(...values: Array<string | undefined>): boolean {
  return values.some((v) => Boolean(v?.trim()));
}

const SECRET_KEYS = [
  {
    key: 'workdrive_master',
    label: 'IMKAN WorkDrive (master)',
    check: () =>
      secretConfigured(
        process.env.WORKDRIVE_MASTER_API_KEY,
        process.env.WORKDRIVE_PLATFORM_API_KEY,
      ),
  },
  {
    key: 'resend',
    label: 'Resend',
    check: () => secretConfigured(process.env.RESEND_API_KEY),
  },
  {
    key: 'brevo',
    label: 'Brevo',
    check: () => secretConfigured(process.env.BREVO_API_KEY),
  },
  {
    key: 'stripe',
    label: 'Stripe',
    check: () => secretConfigured(process.env.STRIPE_SECRET_KEY),
  },
  {
    key: 'lahza',
    label: 'Lahza',
    check: () => secretConfigured(process.env.LAHZA_SECRET_KEY),
  },
  {
    key: 'ai_gemini',
    label: 'Gemini (GEMINI_API_KEY)',
    check: () =>
      configuredAiProvider() === 'gemini' && secretConfigured(process.env.GEMINI_API_KEY),
  },
  {
    key: 'ai_live',
    label: 'AI live (AI_LIVE_ENABLED)',
    check: () => isAiLiveEnabled() && isAiProviderConfigured(),
  },
] as const;

@Injectable()
export class PlatformAdminService {
  constructor(private readonly audit: AuditService) {}

  async metricsOverview() {
    const prisma = getPrisma();
    const [subs, tenantCounts, reconcile, settings] = await Promise.all([
      prisma.workspaceSubscription.findMany({
        select: { planCode: true, status: true, billingCycle: true, xApiAddon: true },
      }),
      prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.storageQuotaReconcile.findFirst({ orderBy: { ranAt: 'desc' } }),
      loadBillingSettings(),
    ]);
    const billing = await estimateMrrUsdCents(subs, settings.xApiAddonMonthlyUsdCents);
    const tenantsByStatus = Object.fromEntries(tenantCounts.map((r) => [r.status, r._count._all]));
    return {
      data: {
        mrr_usd_cents_estimate: billing.mrr_usd_cents,
        active_subscriptions: billing.active_subscriptions,
        tenants_total: tenantCounts.reduce((n, r) => n + r._count._all, 0),
        tenants_active: tenantsByStatus.ACTIVE ?? 0,
        tenants_suspended: tenantsByStatus.SUSPENDED ?? 0,
        workdrive: {
          master_configured: Boolean(workDriveMasterConfig()),
          latest_reconcile_at: reconcile?.ranAt.toISOString() ?? null,
          oma_internal_bytes: reconcile ? String(reconcile.omaInternalBytes) : null,
          platform_used_bytes:
            reconcile?.platformUsedBytes != null ? String(reconcile.platformUsedBytes) : null,
          platform_limit_bytes:
            reconcile?.platformLimitBytes != null ? String(reconcile.platformLimitBytes) : null,
          drift_bytes: reconcile?.driftBytes != null ? String(reconcile.driftBytes) : null,
        },
      },
    };
  }

  async listTenants(input: { q?: string; cursor?: string; take?: number }) {
    const take = Math.min(100, Math.max(1, input.take ?? 50));
    const prisma = getPrisma();
    const rows = await prisma.tenant.findMany({
      where: input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: 'insensitive' } },
              { slug: { contains: input.q, mode: 'insensitive' } },
              { id: input.q },
            ],
          }
        : undefined,
      include: {
        subscription: true,
        storageSetting: true,
        _count: { select: { memberships: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, take);
    const next = rows.length > take ? rows[take]!.id : null;
    return {
      data: page.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        created_at: t.createdAt.toISOString(),
        active_members: t._count.memberships,
        plan_code: t.subscription?.planCode ?? null,
        subscription_status: t.subscription?.status ?? null,
        storage_mode: t.storageSetting?.mode ?? 'OMA_INTERNAL',
        storage_limit_bytes_override:
          t.storageSetting?.adminStorageLimitBytes != null
            ? String(t.storageSetting.adminStorageLimitBytes)
            : null,
      })),
      page: { next_cursor: next, size: page.length },
    };
  }

  async getTenant(tenantId: string) {
    const prisma = getPrisma();
    const t = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true, storageSetting: true },
    });
    if (!t) throw new DomainError('NOT_FOUND', 'Tenant not found', 404, 'errors.not_found');
    const sub = t.subscription;
    const periodStart = sub ? periodStartOf(sub) : new Date();
    const usage = await snapshotUsage(tenantId, periodStart);
    const planCode = normalizePlanCode(sub?.planCode ?? null);
    const plan = planCode ? await hydratePlan(planCode) : null;
    const usage_overrides = await listTenantUsageOverrides(tenantId);
    return {
      data: {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        plan_code: planCode,
        subscription_status: sub?.status ?? null,
        plan_storage_limit_bytes: plan?.limits.storage_bytes ?? null,
        plan_limits: plan?.limits ?? null,
        storage_limit_bytes_override:
          t.storageSetting?.adminStorageLimitBytes != null
            ? String(t.storageSetting.adminStorageLimitBytes)
            : null,
        storage_mode: t.storageSetting?.mode ?? 'OMA_INTERNAL',
        usage_storage_bytes: usage.storage_bytes,
        usage_overrides,
        usage_snapshot: {
          brands: usage.brands,
          social_accounts: usage.social_accounts,
          seats: usage.seats,
          guests: usage.guests,
          scheduled_posts_per_month: usage.scheduled_posts_per_month,
          storage_bytes: usage.storage_bytes,
          ai_credits_per_month: usage.ai_credits_per_month,
          listening_keywords: usage.listening_keywords,
          mentions_per_month: usage.mentions_per_month,
        },
      },
    };
  }

  async createTenant(
    actorUserId: string,
    input: { name: string; slug?: string; owner_user_id?: string },
    correlationId?: string,
  ) {
    const prisma = getPrisma();
    let name: string;
    try {
      name = assertCompanyName(input.name);
    } catch {
      throw new DomainError('VALIDATION_FAILED', 'Invalid company name', 400, 'errors.validation');
    }
    const ownerId = input.owner_user_id?.trim() || actorUserId;
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, status: true },
    });
    if (!owner || owner.status !== 'ACTIVE') {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Owner user not found',
        400,
        'errors.validation_failed',
      );
    }
    const baseSlug = input.slug?.trim()
      ? input.slug.trim().toLowerCase()
      : slugifyCompanyName(name);
    const slug = await uniquifySlug(baseSlug, async (candidate) => {
      const existing = await prisma.tenant.findUnique({ where: { slug: candidate } });
      return !!existing;
    }).catch(() => {
      throw new DomainError('VALIDATION_FAILED', 'Invalid company slug', 400, 'errors.validation');
    });

    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: { id: newId(), name, slug, status: 'ACTIVE' },
      });
      const membership = await tx.membership.create({
        data: {
          id: newId(),
          tenantId: t.id,
          userId: ownerId,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });
      for (const code of SYSTEM_PROFILES.COMPANY_OWNER ?? []) {
        await tx.capabilityGrant.create({
          data: {
            id: newId(),
            membershipId: membership.id,
            tenantId: t.id,
            capabilityCode: code,
            sourceProfileCode: 'COMPANY_OWNER',
          },
        });
      }
      return t;
    });

    await billingService.ensureSubscription(tenant.id, { grandfather: false });

    await this.audit.write({
      actorUserId,
      actorType: 'SUPER_ADMIN',
      tenantId: tenant.id,
      action: 'platform.tenant.created',
      targetType: 'Tenant',
      targetId: tenant.id,
      afterRef: JSON.stringify({ name, slug, owner_user_id: ownerId }),
      correlationId,
    });

    return {
      data: { id: tenant.id, name: tenant.name, slug: tenant.slug, owner_user_id: ownerId },
    };
  }

  async patchTenant(
    actorUserId: string,
    tenantId: string,
    body: {
      status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
      name?: string;
      plan_code?: string;
      billing_cycle?: string;
      storage_limit_bytes?: number | null;
      usage_overrides?: Record<string, number | null>;
      note?: string;
    },
    correlationId?: string,
  ) {
    const prisma = getPrisma();
    const before = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!before) throw new DomainError('NOT_FOUND', 'Tenant not found', 404, 'errors.not_found');

    const updates: { status?: typeof body.status; name?: string } = {};
    if (body.status) updates.status = body.status;
    if (body.name?.trim()) {
      try {
        updates.name = assertCompanyName(body.name.trim());
      } catch {
        throw new DomainError(
          'VALIDATION_FAILED',
          'Invalid company name',
          400,
          'errors.validation',
        );
      }
    }
    if (updates.status || updates.name) {
      await prisma.tenant.update({ where: { id: tenantId }, data: updates });
    }

    if (body.plan_code) {
      await billingService.adminActivate(tenantId, actorUserId, {
        plan_code: body.plan_code,
        billing_cycle: body.billing_cycle,
        note: body.note,
      });
    }

    if (body.storage_limit_bytes !== undefined) {
      const bytes =
        body.storage_limit_bytes == null
          ? null
          : BigInt(Math.max(0, Math.floor(body.storage_limit_bytes)));
      await prisma.workspaceStorageSetting.upsert({
        where: { tenantId },
        create: { tenantId, adminStorageLimitBytes: bytes },
        update: { adminStorageLimitBytes: bytes },
      });
    }

    if (body.usage_overrides && typeof body.usage_overrides === 'object') {
      await upsertTenantUsageOverrides(tenantId, body.usage_overrides);
    }

    await this.audit.write({
      actorUserId,
      actorType: 'SUPER_ADMIN',
      tenantId,
      action: 'platform.tenant.updated',
      targetType: 'Tenant',
      targetId: tenantId,
      beforeRef: JSON.stringify({ status: before.status, name: before.name }),
      afterRef: JSON.stringify(body),
      correlationId,
    });

    return this.getTenant(tenantId);
  }

  systemSecretsStatus() {
    return {
      data: SECRET_KEYS.map((s) => ({
        key: s.key,
        label: s.label,
        configured: s.check(),
        source: 'environment',
      })),
    };
  }

  listOperators(q?: string) {
    return listPlatformOperators(q);
  }

  createOperator(
    actorUserId: string,
    body: Parameters<typeof createOrPromoteOperator>[2],
    correlationId?: string,
  ) {
    return createOrPromoteOperator(this.audit, actorUserId, body, correlationId);
  }

  patchOperator(
    actorUserId: string,
    userId: string,
    body: { system_role?: unknown },
    correlationId?: string,
  ) {
    return patchPlatformOperator(this.audit, actorUserId, userId, body, correlationId);
  }

  listPlans() {
    return listAdminPlans();
  }

  systemIntegrationsStatus() {
    return buildSystemIntegrationsStatus();
  }

  probeRedis() {
    return runProbeRedis();
  }

  probeLiveAi() {
    return runProbeLiveAi();
  }

  probeWebsiteScan(body: { url?: string }) {
    return runProbeWebsiteScan(body);
  }

  patchPlan(
    actorUserId: string,
    planCode: string,
    body: Parameters<typeof patchAdminPlan>[3],
    correlationId?: string,
  ) {
    return patchAdminPlan(this.audit, actorUserId, planCode, body, correlationId);
  }
}
