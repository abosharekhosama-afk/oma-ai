import { getPrisma, tenantWhere } from '@oma/db';
import {
  DomainError,
  PLAN_CATALOG,
  PLAN_FEATURE_MESSAGES,
  PLAN_LIMIT_MESSAGES,
  DEFAULT_PLAN_FOR_NEW_TENANTS,
  GRANDFATHER_PLAN_FOR_EXISTING,
  addBillingPeriod,
  approvalModeAllowed,
  getPlan,
  isPlanCode,
  limitsExceededByUsage,
  newId,
  planHasFeature,
  planPriceUsdCents,
  type BillingCycle,
  type PlanCode,
  type PlanFeatureKey,
  type PlanLimitKey,
} from '@oma/domain';
import { deferredPaymentPort } from './payment-port';

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
    const planCode = opts?.grandfather
      ? GRANDFATHER_PLAN_FOR_EXISTING
      : DEFAULT_PLAN_FOR_NEW_TENANTS;
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
        pct:
          limit == null || limit === 0
            ? limit === 0 && used > 0
              ? 100
              : 0
            : Math.min(100, Math.round((used / limit) * 100)),
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
        payment_configured: deferredPaymentPort.isConfigured(),
        payment_coming_soon: !deferredPaymentPort.isConfigured(),
        current_period_start: sub.currentPeriodStart?.toISOString() ?? null,
        current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
        cancel_at_period_end: sub.cancelAtPeriodEnd,
        pending_plan_code: sub.pendingPlanCode,
        pending_billing_cycle: sub.pendingBillingCycle,
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

  private async assertFitsPlan(tenantId: string, planCode: PlanCode) {
    const usage = await this.usage(tenantId);
    const over = limitsExceededByUsage(getPlan(planCode).limits, usage);
    if (!over.length) return;
    const key = over[0]!;
    const msg = PLAN_LIMIT_MESSAGES[key] ?? {
      en: 'Current usage is above the target plan. Reduce usage before changing plans.',
      ar: 'الاستخدام الحالي أعلى من الخطة المطلوبة. خفّض الاستخدام قبل تغيير الخطة.',
      messageKey: 'errors.plan_limit_reached',
    };
    throw new DomainError('PLAN_LIMIT_REACHED', msg.en, 409, msg.messageKey, [
      {
        limit_key: key,
        plan_code: planCode,
        exceeded: over,
        message_ar: msg.ar,
      },
    ]);
  }

  /** Manual grant. Records a fulfilled checkout so a payment provider can replace this path later. */
  async changePlan(
    tenantId: string,
    actorUserId: string,
    input: { plan_code: string; billing_cycle?: string; notes?: string },
    opts?: { recordCheckout?: boolean },
  ) {
    if (!isPlanCode(input.plan_code)) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid plan', 400, 'errors.validation_failed');
    }
    const cycle: BillingCycle = input.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
    await this.assertFitsPlan(tenantId, input.plan_code);
    const prisma = getPrisma();
    await this.ensureSubscription(tenantId, { grandfather: true });
    const now = new Date();
    const amount = planPriceUsdCents(input.plan_code, cycle);
    const updated = await prisma.workspaceSubscription.update({
      where: { tenantId },
      data: {
        planCode: input.plan_code,
        billingCycle: cycle,
        status: 'active',
        grandfathered: false,
        paymentDeferred: amount !== 0,
        assignedByUserId: actorUserId,
        notes: input.notes?.slice(0, 500) ?? null,
        currentPeriodStart: now,
        currentPeriodEnd: addBillingPeriod(now, cycle),
        cancelAtPeriodEnd: false,
        pendingPlanCode: null,
        pendingBillingCycle: null,
        updatedAt: now,
      },
    });
    if (opts?.recordCheckout !== false) {
      await prisma.billingCheckout.updateMany({
        where: { tenantId, status: 'awaiting_payment' },
        data: { status: 'cancelled', updatedAt: now },
      });
      await prisma.billingCheckout.create({
        data: {
          id: newId(),
          tenantId,
          requestedBy: actorUserId,
          planCode: input.plan_code,
          billingCycle: cycle,
          amountUsdCents: amount,
          status: 'fulfilled',
          provider: 'manual',
          fulfilledAt: now,
          fulfilledBy: actorUserId,
        },
      });
    }
    return {
      data: {
        tenant_id: tenantId,
        plan_code: updated.planCode,
        billing_cycle: updated.billingCycle,
        payment_deferred: updated.paymentDeferred,
        payment_configured: deferredPaymentPort.isConfigured(),
        current_period_end: updated.currentPeriodEnd?.toISOString() ?? null,
        assigned_by: actorUserId,
      },
    };
  }

  async startCheckout(
    tenantId: string,
    actorUserId: string,
    input: { plan_code: string; billing_cycle?: string; note?: string },
  ) {
    if (!isPlanCode(input.plan_code)) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid plan', 400, 'errors.validation_failed');
    }
    const cycle: BillingCycle = input.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = planPriceUsdCents(input.plan_code, cycle);
    if (amount === 0) {
      const applied = await this.changePlan(tenantId, actorUserId, {
        plan_code: input.plan_code,
        billing_cycle: cycle,
        notes: 'Free plan — no payment required',
      });
      return {
        data: {
          ...applied.data,
          status: 'fulfilled',
          payment_configured: false,
          reason: 'free_plan',
        },
      };
    }
    await this.assertFitsPlan(tenantId, input.plan_code);
    const prisma = getPrisma();
    await this.ensureSubscription(tenantId, { grandfather: true });
    const open = await prisma.billingCheckout.findFirst({
      where: {
        tenantId,
        status: 'awaiting_payment',
        planCode: input.plan_code,
        billingCycle: cycle,
      },
      orderBy: { createdAt: 'desc' },
    });
    const checkout =
      open ??
      (await prisma.billingCheckout.create({
        data: {
          id: newId(),
          tenantId,
          requestedBy: actorUserId,
          planCode: input.plan_code,
          billingCycle: cycle,
          amountUsdCents: amount,
          status: 'awaiting_payment',
          provider: 'deferred',
        },
      }));
    await prisma.workspaceSubscription.update({
      where: { tenantId },
      data: { pendingPlanCode: input.plan_code, pendingBillingCycle: cycle },
    });
    const payment = await deferredPaymentPort.startCheckout({
      checkoutId: checkout.id,
      tenantId,
      planCode: input.plan_code,
      billingCycle: cycle,
      amountUsdCents: amount,
    });
    if (!open) {
      await this.requestUpgrade(tenantId, actorUserId, {
        plan_code: input.plan_code,
        billing_cycle: cycle,
        note: input.note,
      });
    }
    return {
      data: {
        id: checkout.id,
        plan_code: checkout.planCode,
        billing_cycle: checkout.billingCycle,
        amount_usd_cents: checkout.amountUsdCents,
        status: checkout.status,
        payment_configured: payment.configured,
        reason: payment.configured ? null : payment.reason,
        message: {
          en: 'Checkout is ready. Online payment is not connected yet — a workspace admin can apply the plan.',
          ar: 'طلب الدفع جاهز. الدفع الإلكتروني غير مربوط بعد — يمكن لمسؤول مساحة العمل تطبيق الخطة.',
        },
      },
    };
  }

  async listCheckouts(tenantId: string) {
    const rows = await getPrisma().billingCheckout.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        plan_code: r.planCode,
        billing_cycle: r.billingCycle,
        amount_usd_cents: r.amountUsdCents,
        status: r.status,
        provider: r.provider,
        created_at: r.createdAt.toISOString(),
        fulfilled_at: r.fulfilledAt?.toISOString() ?? null,
      })),
      payment_configured: deferredPaymentPort.isConfigured(),
    };
  }

  async fulfillCheckout(tenantId: string, actorUserId: string, checkoutId: string) {
    const prisma = getPrisma();
    const row = await prisma.billingCheckout.findFirst({ where: { id: checkoutId, tenantId } });
    if (!row) throw new DomainError('NOT_FOUND', 'Checkout not found', 404, 'errors.not_found');
    if (row.status !== 'awaiting_payment') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Checkout is not awaiting payment',
        409,
        'error.conflict_state',
      );
    }
    await this.changePlan(
      tenantId,
      actorUserId,
      {
        plan_code: row.planCode,
        billing_cycle: row.billingCycle,
        notes: `Fulfilled checkout ${row.id} (payment provider not connected)`,
      },
      { recordCheckout: false },
    );
    await prisma.billingCheckout.updateMany({
      where: { tenantId, status: 'awaiting_payment', id: { not: row.id } },
      data: { status: 'cancelled' },
    });
    const now = new Date();
    await prisma.billingCheckout.update({
      where: { id: row.id },
      data: {
        status: 'fulfilled',
        provider: 'manual',
        fulfilledAt: now,
        fulfilledBy: actorUserId,
      },
    });
    return { data: { id: row.id, status: 'fulfilled', plan_code: row.planCode } };
  }

  async cancelCheckout(tenantId: string, actorUserId: string, checkoutId: string) {
    const prisma = getPrisma();
    const row = await prisma.billingCheckout.findFirst({ where: { id: checkoutId, tenantId } });
    if (!row) throw new DomainError('NOT_FOUND', 'Checkout not found', 404, 'errors.not_found');
    if (row.status !== 'awaiting_payment') {
      throw new DomainError(
        'CONFLICT_STATE',
        'Checkout is not awaiting payment',
        409,
        'error.conflict_state',
      );
    }
    if (row.requestedBy !== actorUserId) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Only the requester can cancel this checkout',
        403,
        'errors.permission_denied',
      );
    }
    await prisma.billingCheckout.update({
      where: { id: row.id },
      data: { status: 'cancelled' },
    });
    const sub = await prisma.workspaceSubscription.findUnique({ where: { tenantId } });
    if (sub?.pendingPlanCode === row.planCode) {
      await prisma.workspaceSubscription.update({
        where: { tenantId },
        data: { pendingPlanCode: null, pendingBillingCycle: null },
      });
    }
    return { data: { id: row.id, status: 'cancelled' } };
  }

  async setCancelAtPeriodEnd(tenantId: string, cancel: boolean) {
    const prisma = getPrisma();
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    const now = new Date();
    const cycle: BillingCycle = sub.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const updated = await prisma.workspaceSubscription.update({
      where: { tenantId },
      data: {
        cancelAtPeriodEnd: cancel,
        currentPeriodStart: sub.currentPeriodStart ?? now,
        currentPeriodEnd: sub.currentPeriodEnd ?? addBillingPeriod(now, cycle),
      },
    });
    return {
      data: {
        cancel_at_period_end: updated.cancelAtPeriodEnd,
        current_period_end: updated.currentPeriodEnd?.toISOString() ?? null,
        plan_code: updated.planCode,
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
