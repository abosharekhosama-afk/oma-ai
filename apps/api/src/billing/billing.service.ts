import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  PLAN_CATALOG,
  PLAN_FEATURE_MESSAGES,
  PLAN_LIMIT_MESSAGES,
  DEFAULT_PLAN_FOR_NEW_TENANTS,
  GRANDFATHER_PLAN_FOR_EXISTING,
  approvalModeAllowed,
  getPlan,
  isPlanCode,
  newId,
  planHasFeature,
  type BillingCycle,
  type PlanCode,
  type PlanFeatureKey,
  type PlanLimitKey,
} from '@oma/domain';

export type UsageSnapshot = {
  brands: number;
  social_channels: number;
  seats: number;
  guests: number;
  posts_per_month: number;
  posts_total: number;
  storage_bytes: number;
  ai_runs_per_month: number;
};

function monthBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return { start, end };
}

export class BillingService {
  async ensureSubscription(tenantId: string, opts?: { grandfather?: boolean }) {
    const prisma = getPrisma();
    const existing = await prisma.workspaceSubscription.findUnique({ where: { tenantId } });
    if (existing) return existing;
    const planCode = opts?.grandfather ? GRANDFATHER_PLAN_FOR_EXISTING : DEFAULT_PLAN_FOR_NEW_TENANTS;
    return prisma.workspaceSubscription.create({
      data: {
        id: newId(),
        tenantId,
        planCode,
        billingCycle: 'monthly',
        status: 'active',
        grandfathered: Boolean(opts?.grandfather),
        paymentDeferred: true,
        notes: opts?.grandfather
          ? 'Auto-assigned grandfather plan'
          : 'Default plan for new workspace',
      },
    });
  }

  async getPlanCode(tenantId: string): Promise<PlanCode> {
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    return isPlanCode(sub.planCode) ? sub.planCode : DEFAULT_PLAN_FOR_NEW_TENANTS;
  }

  async usage(tenantId: string): Promise<UsageSnapshot> {
    const prisma = getPrisma();
    const { start, end } = monthBounds();
    const [
      brands,
      social_channels,
      seats,
      guests,
      posts_per_month,
      posts_total,
      storageAgg,
      ai_runs_per_month,
    ] = await Promise.all([
      prisma.brandWorkspace.count({
        where: tenantWhere(tenantId, { deletedAt: null }),
      }),
      prisma.socialPage.count({ where: { tenantId } }),
      prisma.membership.count({
        where: tenantWhere(tenantId, {
          status: { in: ['ACTIVE', 'INVITED'] },
          membershipKind: 'team',
        }),
      }),
      prisma.membership.count({
        where: tenantWhere(tenantId, {
          status: { in: ['ACTIVE', 'INVITED'] },
          membershipKind: 'client',
        }),
      }),
      prisma.contentItem.count({
        where: tenantWhere(tenantId, { createdAt: { gte: start, lt: end } }),
      }),
      prisma.contentItem.count({ where: { tenantId } }),
      prisma.mediaAsset.aggregate({
        where: { tenantId, status: { not: 'MISSING' } },
        _sum: { size: true },
      }),
      prisma.aiRun.count({
        where: tenantWhere(tenantId, { createdAt: { gte: start, lt: end } }),
      }),
    ]);
    return {
      brands,
      social_channels,
      seats,
      guests,
      posts_per_month,
      posts_total,
      storage_bytes: Number(storageAgg._sum.size ?? 0n),
      ai_runs_per_month,
    };
  }

  private limitReached(limit: number | null, used: number, adding = 1): boolean {
    if (limit == null) return false;
    return used + adding > limit;
  }

  async assertWithinLimit(
    tenantId: string,
    key: PlanLimitKey,
    opts?: { adding?: number; usedOverride?: number },
  ) {
    const planCode = await this.getPlanCode(tenantId);
    const plan = getPlan(planCode);
    const limit = plan.limits[key];
    if (limit == null) return { planCode, limit, used: opts?.usedOverride ?? 0 };

    let used = opts?.usedOverride;
    if (used == null) {
      const snap = await this.usage(tenantId);
      used = snap[key as keyof UsageSnapshot] as number;
    }
    const adding = opts?.adding ?? 1;
    if (this.limitReached(limit, used, adding)) {
      const msg = PLAN_LIMIT_MESSAGES[key] ?? {
        en: 'Plan limit reached. Upgrade to continue.',
        ar: 'وصلت إلى حد الخطة. رقِّ للمتابعة.',
        messageKey: 'errors.plan_limit_reached',
      };
      throw new DomainError('PLAN_LIMIT_REACHED', msg.en, 402, msg.messageKey, [
        {
          limit_key: key,
          plan_code: planCode,
          limit,
          used,
          adding,
          upgrade_path: '/app/billing',
          message_ar: msg.ar,
        },
      ]);
    }
    return { planCode, limit, used };
  }

  async assertFeature(tenantId: string, feature: PlanFeatureKey) {
    const planCode = await this.getPlanCode(tenantId);
    if (planHasFeature(planCode, feature)) return { planCode };
    const msg = PLAN_FEATURE_MESSAGES[feature] ?? {
      en: 'This feature is not included in your plan. Upgrade to unlock it.',
      ar: 'هذه الميزة غير مشمولة في خطتك. رقِّ لتفعيلها.',
      messageKey: 'errors.plan_feature_required',
    };
    throw new DomainError('PLAN_FEATURE_REQUIRED', msg.en, 402, msg.messageKey, [
      {
        feature,
        plan_code: planCode,
        upgrade_path: '/app/billing',
        message_ar: msg.ar,
      },
    ]);
  }

  async assertApprovalMode(tenantId: string, mode: string) {
    const planCode = await this.getPlanCode(tenantId);
    if (approvalModeAllowed(planCode, mode)) return { planCode };
    const feature: PlanFeatureKey =
      mode === 'multi_level' ? 'approvals_multi_level' : 'approvals_required';
    await this.assertFeature(tenantId, feature);
  }

  async listPlans() {
    return Object.values(PLAN_CATALOG).map((p) => ({
      code: p.code,
      name: { en: p.nameEn, ar: p.nameAr },
      description: { en: p.descriptionEn, ar: p.descriptionAr },
      price_monthly_usd: p.priceMonthlyUsd,
      price_yearly_per_month_usd: p.priceYearlyPerMonthUsd,
      popular: Boolean(p.popular),
      limits: p.limits,
      features: p.features,
      payment_deferred: true,
    }));
  }

  async getSubscriptionView(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    const planCode = isPlanCode(sub.planCode) ? sub.planCode : DEFAULT_PLAN_FOR_NEW_TENANTS;
    const plan = getPlan(planCode);
    const usage = await this.usage(tenantId);
    const limits = plan.limits;
    const usageBars = (Object.keys(limits) as PlanLimitKey[]).map((key) => {
      const limit = limits[key];
      const used = (usage as Record<string, number>)[key] ?? 0;
      return {
        key,
        used,
        limit,
        unlimited: limit == null,
        pct: limit == null || limit === 0 ? (limit === 0 && used > 0 ? 100 : 0) : Math.min(100, Math.round((used / limit) * 100)),
      };
    });
    return {
      data: {
        tenant_id: tenantId,
        plan_code: planCode,
        billing_cycle: sub.billingCycle,
        status: sub.status,
        grandfathered: sub.grandfathered,
        payment_deferred: sub.paymentDeferred,
        payment_coming_soon: true,
        started_at: sub.startedAt.toISOString(),
        plan: {
          code: plan.code,
          name: { en: plan.nameEn, ar: plan.nameAr },
          description: { en: plan.descriptionEn, ar: plan.descriptionAr },
          price_monthly_usd: plan.priceMonthlyUsd,
          price_yearly_per_month_usd: plan.priceYearlyPerMonthUsd,
          limits: plan.limits,
          features: plan.features,
        },
        usage,
        usage_bars: usageBars,
      },
    };
  }

  async changePlan(
    tenantId: string,
    actorUserId: string,
    input: { plan_code: string; billing_cycle?: string; notes?: string },
  ) {
    if (!isPlanCode(input.plan_code)) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid plan', 400, 'errors.validation_failed');
    }
    const cycle: BillingCycle =
      input.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
    const prisma = getPrisma();
    await this.ensureSubscription(tenantId, { grandfather: true });
    const updated = await prisma.workspaceSubscription.update({
      where: { tenantId },
      data: {
        planCode: input.plan_code,
        billingCycle: cycle,
        grandfathered: false,
        paymentDeferred: true,
        assignedByUserId: actorUserId,
        notes: input.notes?.slice(0, 500) ?? null,
        updatedAt: new Date(),
      },
    });
    return {
      data: {
        tenant_id: tenantId,
        plan_code: updated.planCode,
        billing_cycle: updated.billingCycle,
        payment_deferred: true,
        assigned_by: actorUserId,
      },
    };
  }

  async requestUpgrade(
    tenantId: string,
    actorUserId: string,
    input: { plan_code: string; billing_cycle?: string; note?: string },
  ) {
    if (!isPlanCode(input.plan_code)) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid plan', 400, 'errors.validation_failed');
    }
    const from = await this.getPlanCode(tenantId);
    const row = await getPrisma().planUpgradeRequest.create({
      data: {
        id: newId(),
        tenantId,
        requestedBy: actorUserId,
        fromPlanCode: from,
        toPlanCode: input.plan_code,
        billingCycle: input.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
        note: input.note?.slice(0, 1000) ?? null,
        status: 'pending',
      },
    });
    return {
      data: {
        id: row.id,
        from_plan_code: row.fromPlanCode,
        to_plan_code: row.toPlanCode,
        billing_cycle: row.billingCycle,
        status: row.status,
        payment_deferred: true,
        message: {
          en: 'Upgrade request received. Payment is coming soon — an admin can apply the plan meanwhile.',
          ar: 'تم استلام طلب الترقية. الدفع قريباً — يمكن للمسؤول تطبيق الخطة حالياً.',
        },
      },
    };
  }

  async listUpgradeRequests(tenantId: string) {
    const rows = await getPrisma().planUpgradeRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        from_plan_code: r.fromPlanCode,
        to_plan_code: r.toPlanCode,
        billing_cycle: r.billingCycle,
        note: r.note,
        status: r.status,
        requested_by: r.requestedBy,
        created_at: r.createdAt.toISOString(),
      })),
    };
  }
}

export const billingService = new BillingService();
