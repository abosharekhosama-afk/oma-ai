import { createHash } from 'node:crypto';
import { getPrisma } from '@oma/db';
import {
  hydratePlan,
  loadBillingSettings,
  periodStartOf,
  snapshotUsage,
  subscriptionAllowsUsage,
  throwInactive,
  throwLimit,
  type UsageSnapshot,
} from '@oma/db';
import {
  DomainError,
  PLAN_FEATURE_MESSAGES,
  PLAN_LIMIT_MESSAGES,
  DEFAULT_PLAN_FOR_NEW_TENANTS,
  GRANDFATHER_PLAN_FOR_EXISTING,
  addBillingPeriod,
  addDays,
  approvalModeAllowed,
  canonicalLimitKey,
  computeVat,
  formatVatPercent,
  isPlanCode,
  limitsExceededByUsage,
  newId,
  normalizePlanCode,
  planPriceUsdCents,
  verifyLahzaSignature,
  verifyStripeSignature,
  type BillingCycle,
  type PlanCode,
  type PlanFeatureKey,
  type PlanLimitKey,
} from '@oma/domain';
import { AuditService } from '../audit/audit.service';
import {
  extractLahzaReference,
  startLahzaCheckout,
  verifyLahzaTransaction,
} from './providers/lahza.adapter';
import { listPaymentProviders, providerIsManual, stripeConfigured } from './providers/registry';
import { createStripePortal, startStripeCheckout } from './providers/stripe.adapter';

const audit = new AuditService();

function webBase(): string {
  return (process.env.WEB_BASE_URL || process.env.WEB_ORIGIN || 'http://127.0.0.1:3000').replace(
    /\/$/,
    '',
  );
}

function asCycle(v?: string): BillingCycle {
  return v === 'yearly' ? 'yearly' : 'monthly';
}

function paymentReference(): string {
  return `OMA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function requirePlan(code: string): PlanCode {
  const normalized = normalizePlanCode(code);
  if (!normalized || !isPlanCode(normalized)) {
    throw new DomainError('VALIDATION_FAILED', 'Invalid plan', 400, 'errors.validation_failed');
  }
  return normalized;
}

export class BillingService {
  async ensureSubscription(tenantId: string, opts?: { grandfather?: boolean }) {
    const prisma = getPrisma();
    const existing = await prisma.workspaceSubscription.findUnique({ where: { tenantId } });
    if (existing) return existing;
    const settings = await loadBillingSettings();
    const grandfather = Boolean(opts?.grandfather);
    const planCode = grandfather ? GRANDFATHER_PLAN_FOR_EXISTING : DEFAULT_PLAN_FOR_NEW_TENANTS;
    const now = new Date();
    const trialDays = grandfather ? 0 : settings.trialDays;
    const status = grandfather ? 'active' : trialDays > 0 ? 'trialing' : 'incomplete';
    return prisma.workspaceSubscription.create({
      data: {
        id: newId(),
        tenantId,
        planCode,
        billingCycle: 'monthly',
        status,
        grandfathered: grandfather,
        paymentDeferred: false,
        vatRateBps: settings.vatRateBps,
        trialEndsAt: trialDays > 0 ? addDays(now, trialDays) : null,
        currentPeriodStart: now,
        currentPeriodEnd:
          trialDays > 0 ? addDays(now, trialDays) : addBillingPeriod(now, 'monthly'),
        notes: grandfather ? 'Auto-assigned grandfather plan' : 'Default plan for new workspace',
      },
    });
  }

  async getPlanCode(tenantId: string): Promise<PlanCode> {
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    return normalizePlanCode(sub.planCode) ?? DEFAULT_PLAN_FOR_NEW_TENANTS;
  }

  async usage(tenantId: string): Promise<UsageSnapshot> {
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    return snapshotUsage(tenantId, periodStartOf(sub));
  }

  async assertWriteAccess(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    const access = subscriptionAllowsUsage(sub);
    if (!access.ok) throwInactive(access.reason);
    return sub;
  }

  async assertWithinLimit(
    tenantId: string,
    key: PlanLimitKey | string,
    opts?: { adding?: number; usedOverride?: number },
  ) {
    await this.assertWriteAccess(tenantId);
    const planCode = await this.getPlanCode(tenantId);
    const plan = await hydratePlan(planCode);
    const canonical = canonicalLimitKey(key);
    const limit = plan.limits[canonical] ?? plan.limits[key as PlanLimitKey];
    if (limit == null) return { planCode, limit, used: opts?.usedOverride ?? 0 };
    let used = opts?.usedOverride;
    if (used == null) {
      const snap = await this.usage(tenantId);
      used =
        (snap as Record<string, number>)[canonical] ?? (snap as Record<string, number>)[key] ?? 0;
    }
    const adding = opts?.adding ?? 1;
    if (used + adding > limit) throwLimit(key, planCode, limit, used, adding);
    return { planCode, limit, used };
  }

  async consumeUsage(tenantId: string, key: string, adding = 1) {
    const { enforceAndConsumeUsage } = await import('@oma/db');
    return enforceAndConsumeUsage(tenantId, key, adding);
  }

  async assertFeature(tenantId: string, feature: PlanFeatureKey) {
    await this.assertWriteAccess(tenantId);
    const planCode = await this.getPlanCode(tenantId);
    const plan = await hydratePlan(planCode);
    if (plan.features[feature]) return { planCode };
    const msg = PLAN_FEATURE_MESSAGES[feature] ?? {
      en: 'This feature is not included in your plan. Upgrade to unlock it.',
      ar: 'هذه الميزة غير مشمولة في خطتك. رقِّ لتفعيلها.',
      messageKey: 'errors.plan_feature_required',
    };
    throw new DomainError('PLAN_FEATURE_REQUIRED', msg.en, 402, msg.messageKey, [
      { feature, plan_code: planCode, upgrade_path: '/app/billing', message_ar: msg.ar },
    ]);
  }

  async assertApprovalMode(tenantId: string, mode: string) {
    const planCode = await this.getPlanCode(tenantId);
    if (approvalModeAllowed(planCode, mode)) return { planCode };
    const feature: PlanFeatureKey =
      mode === 'multi_level' ? 'approvals_multi_level' : 'approvals_required';
    await this.assertFeature(tenantId, feature);
  }

  async assertAddon(tenantId: string, addon: 'x_api') {
    const sub = await this.assertWriteAccess(tenantId);
    if (addon === 'x_api' && !sub.xApiAddon) {
      throw new DomainError(
        'ADDON_REQUIRED',
        'Paid X API access is an add-on. Enable it from billing to connect X.',
        402,
        'errors.addon_required',
        [
          {
            addon,
            upgrade_path: '/app/billing',
            message_ar: 'الوصول إلى واجهة إكس المدفوعة إضافة. فعّلها من الفوترة لربط إكس.',
          },
        ],
      );
    }
    return sub;
  }

  async listPlans() {
    const settings = await loadBillingSettings();
    const prisma = getPrisma();
    const rows = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    const codes = rows.length
      ? rows.map((r) => r.code)
      : (['starter', 'pro', 'agency'] as PlanCode[]);
    const plans = [];
    for (const code of codes) {
      const normalized = normalizePlanCode(code);
      if (!normalized) continue;
      const plan = await hydratePlan(normalized);
      const monthly = Math.round(plan.priceMonthlyUsd * 100);
      const vat = computeVat(monthly, settings.vatRateBps);
      plans.push({
        code: plan.code,
        name: { en: plan.nameEn, ar: plan.nameAr },
        description: { en: plan.descriptionEn, ar: plan.descriptionAr },
        price_monthly_usd: plan.priceMonthlyUsd,
        price_yearly_per_month_usd: plan.priceYearlyPerMonthUsd,
        popular: Boolean(plan.popular),
        limits: plan.limits,
        features: plan.features,
        vat_rate_bps: vat.vat_rate_bps,
        vat_percent: formatVatPercent(vat.vat_rate_bps),
        monthly_vat: vat,
      });
    }
    return plans;
  }

  async getSubscriptionView(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    const planCode = normalizePlanCode(sub.planCode) ?? DEFAULT_PLAN_FOR_NEW_TENANTS;
    const plan = await hydratePlan(planCode);
    const usage = await snapshotUsage(tenantId, periodStartOf(sub));
    const settings = await loadBillingSettings();
    const hidden = new Set(['approval_level', 'posts_total']);
    const usageBars = (Object.keys(plan.limits) as PlanLimitKey[])
      .filter(
        (key) =>
          !hidden.has(key) &&
          !['social_channels', 'posts_per_month', 'ai_runs_per_month'].includes(key),
      )
      .map((key) => {
        const limit = plan.limits[key];
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
    const invoices = await getPrisma().billingInvoice.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
    return {
      data: {
        tenant_id: tenantId,
        plan_code: planCode,
        billing_cycle: sub.billingCycle,
        status: sub.status,
        grandfathered: sub.grandfathered,
        payment_deferred: sub.paymentDeferred,
        payment_configured: listPaymentProviders().some((p) => p.configured && p.mode === 'live'),
        payment_coming_soon: false,
        provider: sub.provider,
        x_api_addon: sub.xApiAddon,
        vat_rate_bps: sub.vatRateBps ?? settings.vatRateBps,
        vat_percent: formatVatPercent(sub.vatRateBps ?? settings.vatRateBps),
        current_period_start: sub.currentPeriodStart?.toISOString() ?? null,
        current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
        cancel_at_period_end: sub.cancelAtPeriodEnd,
        pending_plan_code: sub.pendingPlanCode,
        pending_billing_cycle: sub.pendingBillingCycle,
        grace_period_ends_at: sub.gracePeriodEndsAt?.toISOString() ?? null,
        trial_ends_at: sub.trialEndsAt?.toISOString() ?? null,
        started_at: sub.startedAt.toISOString(),
        has_stripe_portal: Boolean(sub.providerCustomerId && stripeConfigured()),
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
        invoices: invoices.map((r) => this.mapInvoice(r)),
        providers: listPaymentProviders(),
        addon: {
          code: 'x_api',
          price_monthly_usd: settings.xApiAddonMonthlyUsdCents / 100,
        },
      },
    };
  }

  private mapInvoice(r: {
    id: string;
    provider: string;
    number: string | null;
    status: string;
    currency: string;
    amountExVatCents: number;
    vatRateBps: number;
    vatCents: number;
    amountIncVatCents: number;
    hostedUrl: string | null;
    pdfUrl: string | null;
    createdAt: Date;
    paidAt: Date | null;
    periodStart: Date | null;
    periodEnd: Date | null;
  }) {
    return {
      id: r.id,
      provider: r.provider,
      number: r.number,
      status: r.status,
      currency: r.currency,
      amount_ex_vat_cents: r.amountExVatCents,
      vat_rate_bps: r.vatRateBps,
      vat_cents: r.vatCents,
      amount_inc_vat_cents: r.amountIncVatCents,
      hosted_url: r.hostedUrl,
      pdf_url: r.pdfUrl,
      created_at: r.createdAt.toISOString(),
      paid_at: r.paidAt?.toISOString() ?? null,
      period_start: r.periodStart?.toISOString() ?? null,
      period_end: r.periodEnd?.toISOString() ?? null,
    };
  }

  private async assertFitsPlan(tenantId: string, planCode: PlanCode) {
    const usage = await this.usage(tenantId);
    const plan = await hydratePlan(planCode);
    const over = limitsExceededByUsage(plan.limits, usage);
    if (!over.length) return;
    const key = over[0]!;
    const msg = PLAN_LIMIT_MESSAGES[key] ?? {
      en: 'Current usage is above the target plan. Reduce usage before changing plans.',
      ar: 'الاستخدام الحالي أعلى من الخطة المطلوبة. خفّض الاستخدام قبل تغيير الخطة.',
      messageKey: 'errors.plan_limit_reached',
    };
    throw new DomainError('PLAN_LIMIT_REACHED', msg.en, 409, msg.messageKey, [
      { limit_key: key, plan_code: planCode, exceeded: over, message_ar: msg.ar },
    ]);
  }

  private quoteFor(
    planCode: PlanCode,
    cycle: BillingCycle,
    vatRateBps: number,
    xApiAddon: boolean,
    addonCents: number,
  ) {
    const plan = computeVat(planPriceUsdCents(planCode, cycle), vatRateBps);
    const addon = xApiAddon
      ? computeVat(cycle === 'yearly' ? addonCents * 10 : addonCents, vatRateBps)
      : computeVat(0, vatRateBps);
    return {
      plan,
      addon,
      total_ex_vat_cents: plan.ex_vat_cents + addon.ex_vat_cents,
      total_vat_cents: plan.vat_cents + addon.vat_cents,
      total_inc_vat_cents: plan.inc_vat_cents + addon.inc_vat_cents,
    };
  }

  async activatePlan(
    tenantId: string,
    actorUserId: string | null,
    input: {
      planCode: PlanCode;
      billingCycle: BillingCycle;
      provider: string;
      notes?: string;
      reference?: string;
      xApiAddon?: boolean;
      providerCustomerId?: string | null;
      providerSubscriptionId?: string | null;
      providerAuthCode?: string | null;
      vatRateBps?: number;
      status?: string;
      periodDays?: number;
    },
  ) {
    await this.assertFitsPlan(tenantId, input.planCode);
    const prisma = getPrisma();
    await this.ensureSubscription(tenantId, { grandfather: true });
    const settings = await loadBillingSettings();
    const now = new Date();
    const cycle = input.billingCycle;
    const end = input.periodDays ? addDays(now, input.periodDays) : addBillingPeriod(now, cycle);
    const updated = await prisma.workspaceSubscription.update({
      where: { tenantId },
      data: {
        planCode: input.planCode,
        billingCycle: cycle,
        status: input.status ?? 'active',
        grandfathered: false,
        paymentDeferred: false,
        assignedByUserId: actorUserId,
        notes: input.notes?.slice(0, 1000) ?? null,
        currentPeriodStart: now,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
        pendingPlanCode: null,
        pendingBillingCycle: null,
        provider: input.provider,
        providerCustomerId: input.providerCustomerId ?? undefined,
        providerSubscriptionId: input.providerSubscriptionId ?? undefined,
        providerAuthCode: input.providerAuthCode ?? undefined,
        xApiAddon: Boolean(input.xApiAddon),
        vatRateBps: input.vatRateBps ?? settings.vatRateBps,
        gracePeriodEndsAt: null,
        trialEndsAt: null,
        updatedAt: now,
      },
    });
    const quote = this.quoteFor(
      input.planCode,
      cycle,
      updated.vatRateBps ?? settings.vatRateBps,
      updated.xApiAddon,
      settings.xApiAddonMonthlyUsdCents,
    );
    await prisma.billingInvoice.create({
      data: {
        id: newId(),
        tenantId,
        provider: input.provider,
        providerInvoiceId: input.reference ? `${input.provider}:${input.reference}` : newId(),
        number: input.reference ?? null,
        status: 'paid',
        currency: settings.currency,
        amountExVatCents: quote.total_ex_vat_cents,
        vatRateBps: quote.plan.vat_rate_bps,
        vatCents: quote.total_vat_cents,
        amountIncVatCents: quote.total_inc_vat_cents,
        periodStart: now,
        periodEnd: end,
        paidAt: now,
      },
    });
    await audit.write({
      actorUserId,
      tenantId,
      action: 'billing.plan.activated',
      targetType: 'WorkspaceSubscription',
      targetId: updated.id,
      afterRef: JSON.stringify({
        planCode: input.planCode,
        provider: input.provider,
        reference: input.reference ?? null,
      }),
    });
    return updated;
  }

  async startCheckout(
    tenantId: string,
    actorUserId: string,
    input: {
      plan_code: string;
      billing_cycle?: string;
      provider?: string;
      x_api_addon?: boolean;
      note?: string;
    },
  ) {
    const planCode = requirePlan(input.plan_code);
    const cycle = asCycle(input.billing_cycle);
    await this.assertFitsPlan(tenantId, planCode);
    const settings = await loadBillingSettings();
    const provider = (input.provider ?? (stripeConfigured() ? 'stripe' : 'bank_transfer')).trim();
    const providers = listPaymentProviders();
    const info = providers.find((p) => p.id === provider);
    if (!info || !info.configured) {
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'That payment method is not available',
        400,
        'errors.provider_not_configured',
      );
    }
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: actorUserId } });
    const quote = this.quoteFor(
      planCode,
      cycle,
      settings.vatRateBps,
      Boolean(input.x_api_addon),
      settings.xApiAddonMonthlyUsdCents,
    );
    const checkout = await prisma.billingCheckout.create({
      data: {
        id: newId(),
        tenantId,
        requestedBy: actorUserId,
        planCode,
        billingCycle: cycle,
        amountUsdCents: quote.plan.ex_vat_cents,
        status: 'awaiting_payment',
        provider,
      },
    });
    await prisma.workspaceSubscription.update({
      where: { tenantId },
      data: { pendingPlanCode: planCode, pendingBillingCycle: cycle },
    });
    const metadata = {
      tenant_id: tenantId,
      plan_code: planCode,
      billing_cycle: cycle,
      checkout_id: checkout.id,
      x_api_addon: input.x_api_addon ? '1' : '0',
      vat_rate_bps: String(settings.vatRateBps),
      amount_ex_vat_cents: String(quote.total_ex_vat_cents),
      vat_cents: String(quote.total_vat_cents),
      amount_inc_vat_cents: String(quote.total_inc_vat_cents),
    };
    const plan = await hydratePlan(planCode);
    const common = {
      checkoutId: checkout.id,
      tenantId,
      planCode,
      planName: plan.nameEn,
      billingCycle: cycle,
      amountExVatCents: quote.plan.ex_vat_cents,
      vatRateBps: settings.vatRateBps,
      vatCents: quote.plan.vat_cents,
      amountIncVatCents: quote.plan.inc_vat_cents,
      currency: settings.currency,
      customerEmail: user?.email ?? null,
      customerName: user?.name ?? null,
      successUrl: `${webBase()}/app/billing?checkout=success&provider=${provider}`,
      cancelUrl: `${webBase()}/app/billing?checkout=cancel`,
      xApiAddon: Boolean(input.x_api_addon),
      addonExVatCents: quote.addon.ex_vat_cents,
      addonIncVatCents: quote.addon.inc_vat_cents,
      metadata,
    };

    if (provider === 'stripe') {
      const payment = await startStripeCheckout(common);
      if (payment.configured && payment.providerRef) {
        await prisma.billingCheckout.update({
          where: { id: checkout.id },
          data: { providerRef: payment.providerRef },
        });
      }
      return {
        data: {
          id: checkout.id,
          plan_code: planCode,
          billing_cycle: cycle,
          provider,
          status: checkout.status,
          amount_ex_vat_cents: quote.total_ex_vat_cents,
          vat_cents: quote.total_vat_cents,
          amount_inc_vat_cents: quote.total_inc_vat_cents,
          vat_percent: formatVatPercent(settings.vatRateBps),
          payment_configured: payment.configured,
          redirect_url: payment.configured ? payment.redirectUrl : null,
          message: {
            en: 'Continue to Stripe Checkout to complete payment. VAT is added server-side.',
            ar: 'تابع إلى صفحة سترايب لإكمال الدفع. تُحسب الضريبة من الخادم.',
          },
        },
      };
    }

    if (provider === 'lahza') {
      const payment = await startLahzaCheckout(common);
      if (payment.configured && payment.providerRef) {
        await prisma.billingCheckout.update({
          where: { id: checkout.id },
          data: { providerRef: payment.providerRef },
        });
      }
      return {
        data: {
          id: checkout.id,
          plan_code: planCode,
          billing_cycle: cycle,
          provider,
          status: checkout.status,
          amount_ex_vat_cents: quote.total_ex_vat_cents,
          vat_cents: quote.total_vat_cents,
          amount_inc_vat_cents: quote.total_inc_vat_cents,
          vat_percent: formatVatPercent(settings.vatRateBps),
          payment_configured: payment.configured,
          redirect_url: payment.configured ? payment.redirectUrl : null,
          message: {
            en: 'Continue to Lahza (Bank of Palestine) to complete payment.',
            ar: 'تابع إلى لحظة (بنك فلسطين) لإكمال الدفع.',
          },
        },
      };
    }

    if (!providerIsManual(provider)) {
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'That payment method is not available',
        400,
        'errors.provider_not_configured',
      );
    }

    const reference = paymentReference();
    const extra =
      provider === 'jawwal_pay'
        ? {
            en: 'Send the transfer through Jawwal Pay using the reference below, then upload proof.',
            ar: 'أرسل التحويل عبر جوال باي مع رقم المرجع أدناه ثم ارفع إثبات الدفع.',
          }
        : provider === 'palpay'
          ? {
              en: 'Send the transfer through PalPay using the reference below, then upload proof.',
              ar: 'أرسل التحويل عبر بال بي مع رقم المرجع أدناه ثم ارفع إثبات الدفع.',
            }
          : provider === 'reflect'
            ? {
                en: 'Send the transfer through Reflect using the reference below, then upload proof.',
                ar: 'أرسل التحويل عبر ريفلكت مع رقم المرجع أدناه ثم ارفع إثبات الدفع.',
              }
            : {
                en:
                  settings.bankInstructionsEn ??
                  'Transfer the billed amount and include the reference number.',
                ar: settings.bankInstructionsAr ?? 'حوّل المبلغ المذكور وأضف رقم المرجع.',
              };
    const order = await prisma.manualPaymentOrder.create({
      data: {
        id: newId(),
        tenantId,
        requestedBy: actorUserId,
        planCode,
        billingCycle: cycle,
        xApiAddon: Boolean(input.x_api_addon),
        provider,
        reference,
        amountExVatCents: quote.total_ex_vat_cents,
        vatRateBps: settings.vatRateBps,
        vatCents: quote.total_vat_cents,
        amountIncVatCents: quote.total_inc_vat_cents,
        currency: settings.currency,
        status: 'awaiting_payment',
        instructionsEn: extra.en,
        instructionsAr: extra.ar,
      },
    });
    await prisma.billingCheckout.update({
      where: { id: checkout.id },
      data: { providerRef: reference },
    });
    return {
      data: {
        id: checkout.id,
        order_id: order.id,
        plan_code: planCode,
        billing_cycle: cycle,
        provider,
        status: 'awaiting_payment',
        reference,
        amount_ex_vat_cents: quote.total_ex_vat_cents,
        vat_cents: quote.total_vat_cents,
        amount_inc_vat_cents: quote.total_inc_vat_cents,
        vat_percent: formatVatPercent(settings.vatRateBps),
        payment_configured: true,
        instructions: extra,
        message: {
          en: `Pay the amount shown and include reference ${reference}. Upload proof so the platform owner can activate the plan.`,
          ar: `ادفع المبلغ الظاهر وأضف المرجع ${reference}. ارفع إثبات الدفع ليتمكّن مالك المنصة من تفعيل الخطة.`,
        },
      },
    };
  }

  async submitManualProof(
    tenantId: string,
    actorUserId: string,
    input: {
      reference?: string;
      order_id?: string;
      proof_note?: string;
      proof_file_name?: string;
      proof_mime?: string;
    },
  ) {
    const prisma = getPrisma();
    const order = await prisma.manualPaymentOrder.findFirst({
      where: {
        tenantId,
        ...(input.order_id ? { id: input.order_id } : {}),
        ...(input.reference ? { reference: input.reference } : {}),
        status: { in: ['awaiting_payment', 'proof_uploaded'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!order)
      throw new DomainError('NOT_FOUND', 'Payment order not found', 404, 'errors.not_found');
    if (order.requestedBy !== actorUserId) {
      throw new DomainError(
        'PERMISSION_DENIED',
        'Only the requester can submit proof',
        403,
        'errors.permission_denied',
      );
    }
    const updated = await prisma.manualPaymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'proof_uploaded',
        proofNote: input.proof_note?.slice(0, 2000) ?? order.proofNote,
        proofFileName: input.proof_file_name?.slice(0, 200) ?? order.proofFileName,
        proofMime: input.proof_mime?.slice(0, 120) ?? order.proofMime,
      },
    });
    await audit.write({
      actorUserId,
      tenantId,
      action: 'billing.manual.proof_uploaded',
      targetType: 'ManualPaymentOrder',
      targetId: updated.id,
      afterRef: JSON.stringify({ reference: updated.reference }),
    });
    return { data: { id: updated.id, status: updated.status, reference: updated.reference } };
  }

  async listCheckouts(tenantId: string) {
    const [rows, orders] = await Promise.all([
      getPrisma().billingCheckout.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      getPrisma().manualPaymentOrder.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);
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
      orders: orders.map((o) => ({
        id: o.id,
        reference: o.reference,
        provider: o.provider,
        status: o.status,
        plan_code: o.planCode,
        amount_inc_vat_cents: o.amountIncVatCents,
        vat_cents: o.vatCents,
        instructions: { en: o.instructionsEn, ar: o.instructionsAr },
        created_at: o.createdAt.toISOString(),
      })),
      payment_configured: listPaymentProviders().some((p) => p.configured),
    };
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
    await prisma.billingCheckout.update({ where: { id: row.id }, data: { status: 'cancelled' } });
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

  async createPortal(tenantId: string) {
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    if (!sub.providerCustomerId) {
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'No Stripe customer is linked to this workspace yet',
        400,
        'errors.provider_not_configured',
      );
    }
    const portal = await createStripePortal(sub.providerCustomerId, `${webBase()}/app/billing`);
    if (!portal.configured) {
      throw new DomainError(
        'PROVIDER_NOT_CONFIGURED',
        'Stripe is not configured',
        400,
        'errors.provider_not_configured',
      );
    }
    return { data: { redirect_url: portal.redirectUrl } };
  }

  async confirmLahza(tenantId: string, reference: string) {
    const verified = await verifyLahzaTransaction(reference);
    if (!verified.ok) {
      throw new DomainError(
        'PAYMENT_REQUIRED',
        'Lahza payment is not successful yet',
        402,
        'errors.payment_required',
      );
    }
    return this.fulfillProviderPayment({
      tenantId,
      provider: 'lahza',
      reference,
      amountCents: verified.amount,
      authorizationCode: verified.authorizationCode,
    });
  }

  private async fulfillProviderPayment(input: {
    tenantId?: string;
    provider: string;
    reference: string;
    amountCents?: number;
    authorizationCode?: string;
    customerId?: string;
    subscriptionId?: string;
  }) {
    const prisma = getPrisma();
    const checkout = await prisma.billingCheckout.findFirst({
      where: {
        OR: [{ id: input.reference }, { providerRef: input.reference }],
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!checkout) {
      throw new DomainError(
        'NOT_FOUND',
        'Checkout not found for this payment',
        404,
        'errors.not_found',
      );
    }
    if (checkout.status === 'fulfilled') {
      return { data: { id: checkout.id, status: 'fulfilled', plan_code: checkout.planCode } };
    }
    const planCode = requirePlan(checkout.planCode);
    const settings = await loadBillingSettings();
    const quote = this.quoteFor(
      planCode,
      asCycle(checkout.billingCycle),
      settings.vatRateBps,
      false,
      0,
    );
    if (typeof input.amountCents === 'number' && Number.isFinite(input.amountCents)) {
      if (input.amountCents < quote.plan.inc_vat_cents) {
        throw new DomainError(
          'PAYMENT_REQUIRED',
          'Paid amount does not match the plan total',
          402,
          'errors.payment_required',
        );
      }
    }
    await this.activatePlan(checkout.tenantId, checkout.requestedBy, {
      planCode,
      billingCycle: asCycle(checkout.billingCycle),
      provider: input.provider,
      notes: `Paid via ${input.provider} (${input.reference})`,
      reference: input.reference,
      providerCustomerId: input.customerId,
      providerSubscriptionId: input.subscriptionId,
      providerAuthCode: input.authorizationCode,
    });
    await prisma.billingCheckout.update({
      where: { id: checkout.id },
      data: {
        status: 'fulfilled',
        provider: input.provider,
        providerRef: input.reference,
        fulfilledAt: new Date(),
      },
    });
    return { data: { id: checkout.id, status: 'fulfilled', plan_code: planCode } };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const verified = verifyStripeSignature(rawBody, signature, secret ?? '');
    if (!verified.ok) {
      throw new DomainError(
        'PERMISSION_DENIED',
        `Invalid Stripe signature (${verified.reason})`,
        400,
        'errors.permission_denied',
      );
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    if (!event.id || !event.type) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Invalid Stripe event',
        400,
        'errors.validation_failed',
      );
    }
    if (!(await this.claimWebhook('stripe', event.id, event.type, rawBody))) {
      return { received: true, duplicate: true };
    }
    const obj = event.data?.object ?? {};
    try {
      if (event.type === 'checkout.session.completed') {
        const metadata = (obj.metadata ?? {}) as Record<string, string>;
        const reference = typeof obj.id === 'string' ? obj.id : metadata.checkout_id;
        if (reference) {
          await this.fulfillProviderPayment({
            tenantId: metadata.tenant_id,
            provider: 'stripe',
            reference: metadata.checkout_id || reference,
            customerId: typeof obj.customer === 'string' ? obj.customer : undefined,
            subscriptionId: typeof obj.subscription === 'string' ? obj.subscription : undefined,
          });
        }
      } else if (
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        await this.syncStripeSubscription(obj, event.type === 'customer.subscription.deleted');
      } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
        await this.syncStripeInvoice(obj, event.type === 'invoice.paid');
      }
    } catch (err) {
      await getPrisma().billingWebhookEvent.deleteMany({
        where: { provider: 'stripe', eventId: event.id },
      });
      throw err;
    }
    return { received: true };
  }

  private async syncStripeSubscription(obj: Record<string, unknown>, deleted: boolean) {
    const id = typeof obj.id === 'string' ? obj.id : null;
    if (!id) return;
    const prisma = getPrisma();
    const sub = await prisma.workspaceSubscription.findFirst({
      where: { provider: 'stripe', providerSubscriptionId: id },
    });
    if (!sub) return;
    const stripeStatus = typeof obj.status === 'string' ? obj.status : '';
    const mapped = deleted
      ? 'canceled'
      : stripeStatus === 'trialing'
        ? 'trialing'
        : stripeStatus === 'active'
          ? 'active'
          : stripeStatus === 'past_due' || stripeStatus === 'unpaid'
            ? 'past_due'
            : stripeStatus === 'canceled'
              ? 'canceled'
              : sub.status;
    const settings = await loadBillingSettings();
    await prisma.workspaceSubscription.update({
      where: { id: sub.id },
      data: {
        status: mapped,
        cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
        gracePeriodEndsAt:
          mapped === 'past_due'
            ? (sub.gracePeriodEndsAt ?? addDays(new Date(), settings.gracePeriodDays))
            : null,
      },
    });
  }

  private async syncStripeInvoice(obj: Record<string, unknown>, paid: boolean) {
    const customer = typeof obj.customer === 'string' ? obj.customer : null;
    const prisma = getPrisma();
    const sub = customer
      ? await prisma.workspaceSubscription.findFirst({
          where: { provider: 'stripe', providerCustomerId: customer },
        })
      : null;
    if (!sub) return;
    const settings = await loadBillingSettings();
    if (!paid) {
      await prisma.workspaceSubscription.update({
        where: { id: sub.id },
        data: {
          status: 'past_due',
          gracePeriodEndsAt: sub.gracePeriodEndsAt ?? addDays(new Date(), settings.gracePeriodDays),
        },
      });
      return;
    }
    const quote = this.quoteFor(
      normalizePlanCode(sub.planCode) ?? DEFAULT_PLAN_FOR_NEW_TENANTS,
      asCycle(sub.billingCycle),
      sub.vatRateBps ?? settings.vatRateBps,
      sub.xApiAddon,
      settings.xApiAddonMonthlyUsdCents,
    );
    const providerInvoiceId = typeof obj.id === 'string' ? obj.id : newId();
    await prisma.billingInvoice.upsert({
      where: { provider_providerInvoiceId: { provider: 'stripe', providerInvoiceId } },
      create: {
        id: newId(),
        tenantId: sub.tenantId,
        provider: 'stripe',
        providerInvoiceId,
        number: typeof obj.number === 'string' ? obj.number : null,
        status: 'paid',
        currency: settings.currency,
        amountExVatCents: quote.total_ex_vat_cents,
        vatRateBps: quote.plan.vat_rate_bps,
        vatCents: quote.total_vat_cents,
        amountIncVatCents: quote.total_inc_vat_cents,
        hostedUrl: typeof obj.hosted_invoice_url === 'string' ? obj.hosted_invoice_url : null,
        pdfUrl: typeof obj.invoice_pdf === 'string' ? obj.invoice_pdf : null,
        paidAt: new Date(),
        periodStart: sub.currentPeriodStart,
        periodEnd: sub.currentPeriodEnd,
      },
      update: { status: 'paid', paidAt: new Date() },
    });
    await prisma.workspaceSubscription.update({
      where: { id: sub.id },
      data: { status: 'active', gracePeriodEndsAt: null },
    });
  }

  async handleLahzaWebhook(rawBody: Buffer, signature: string | undefined) {
    const secret = process.env.LAHZA_WEBHOOK_SECRET?.trim() || process.env.LAHZA_SECRET_KEY?.trim();
    const verified = verifyLahzaSignature(rawBody, signature, secret ?? '');
    if (!verified.ok) {
      throw new DomainError(
        'PERMISSION_DENIED',
        `Invalid Lahza signature (${verified.reason})`,
        400,
        'errors.permission_denied',
      );
    }
    const payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const eventType = typeof payload.event === 'string' ? payload.event : 'charge.unknown';
    const reference = extractLahzaReference(payload);
    const eventId = `${eventType}:${reference ?? createHash('sha256').update(rawBody).digest('hex').slice(0, 32)}`;
    if (!(await this.claimWebhook('lahza', eventId, eventType, rawBody))) {
      return { received: true, duplicate: true };
    }
    try {
      if (eventType === 'charge.success' && reference) {
        const paid = await verifyLahzaTransaction(reference);
        if (paid.ok) {
          await this.fulfillProviderPayment({
            provider: 'lahza',
            reference,
            amountCents: paid.amount,
            authorizationCode: paid.authorizationCode,
          });
        }
      }
    } catch (err) {
      await getPrisma().billingWebhookEvent.deleteMany({ where: { provider: 'lahza', eventId } });
      throw err;
    }
    return { received: true };
  }

  private async claimWebhook(provider: string, eventId: string, eventType: string, raw: Buffer) {
    try {
      await getPrisma().billingWebhookEvent.create({
        data: {
          id: newId(),
          provider,
          eventId,
          eventType,
          payloadHash: createHash('sha256').update(raw).digest('hex'),
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async requestUpgrade(
    tenantId: string,
    actorUserId: string,
    input: { plan_code: string; billing_cycle?: string; note?: string },
  ) {
    const planCode = requirePlan(input.plan_code);
    const from = await this.getPlanCode(tenantId);
    const row = await getPrisma().planUpgradeRequest.create({
      data: {
        id: newId(),
        tenantId,
        requestedBy: actorUserId,
        fromPlanCode: from,
        toPlanCode: planCode,
        billingCycle: asCycle(input.billing_cycle),
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
        message: {
          en: 'Upgrade request recorded. Complete checkout or wait for the platform owner to activate the plan.',
          ar: 'تم تسجيل طلب الترقية. أكمل الدفع أو انتظر تفعيل مالك المنصة.',
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

  async adminListWorkspaces(query?: string) {
    const prisma = getPrisma();
    const rows = await prisma.tenant.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { subscription: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      data: rows.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan_code: t.subscription?.planCode ?? null,
        status: t.subscription?.status ?? null,
        period_end: t.subscription?.currentPeriodEnd?.toISOString() ?? null,
        provider: t.subscription?.provider ?? null,
        x_api_addon: t.subscription?.xApiAddon ?? false,
      })),
    };
  }

  async adminActivate(
    tenantId: string,
    actorUserId: string,
    input: {
      plan_code: string;
      billing_cycle?: string;
      days?: number;
      reference?: string;
      note?: string;
      x_api_addon?: boolean;
    },
  ) {
    const tenant = await getPrisma().tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new DomainError('NOT_FOUND', 'Workspace not found', 404, 'errors.not_found');
    const planCode = requirePlan(input.plan_code);
    const updated = await this.activatePlan(tenantId, actorUserId, {
      planCode,
      billingCycle: asCycle(input.billing_cycle),
      provider: 'manual',
      notes: [input.note, input.reference ? `ref:${input.reference}` : null]
        .filter(Boolean)
        .join(' · '),
      reference: input.reference,
      xApiAddon: input.x_api_addon,
      periodDays: input.days,
    });
    return {
      data: {
        tenant_id: tenantId,
        plan_code: updated.planCode,
        status: updated.status,
        current_period_end: updated.currentPeriodEnd?.toISOString() ?? null,
      },
    };
  }

  async adminExtend(tenantId: string, actorUserId: string, input: { days: number; note?: string }) {
    if (!Number.isFinite(input.days) || input.days < 1 || input.days > 3660) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'days must be between 1 and 3660',
        400,
        'errors.validation_failed',
      );
    }
    const prisma = getPrisma();
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    const base =
      sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? sub.currentPeriodEnd : new Date();
    const updated = await prisma.workspaceSubscription.update({
      where: { tenantId },
      data: {
        status: sub.status === 'canceled' ? 'active' : sub.status,
        currentPeriodEnd: addDays(base, input.days),
        notes: input.note?.slice(0, 1000) ?? sub.notes,
        assignedByUserId: actorUserId,
      },
    });
    await audit.write({
      actorUserId,
      tenantId,
      action: 'billing.manual.extend',
      targetType: 'WorkspaceSubscription',
      targetId: updated.id,
      afterRef: JSON.stringify({ days: input.days, note: input.note ?? null }),
    });
    return {
      data: {
        tenant_id: tenantId,
        current_period_end: updated.currentPeriodEnd?.toISOString() ?? null,
      },
    };
  }

  async adminCancel(tenantId: string, actorUserId: string, input: { note?: string }) {
    const prisma = getPrisma();
    const sub = await this.ensureSubscription(tenantId, { grandfather: true });
    const updated = await prisma.workspaceSubscription.update({
      where: { tenantId },
      data: {
        status: 'canceled',
        cancelAtPeriodEnd: false,
        assignedByUserId: actorUserId,
        notes: input.note?.slice(0, 1000) ?? sub.notes,
      },
    });
    await audit.write({
      actorUserId,
      tenantId,
      action: 'billing.manual.cancel',
      targetType: 'WorkspaceSubscription',
      targetId: updated.id,
      afterRef: JSON.stringify({ note: input.note ?? null }),
    });
    return { data: { tenant_id: tenantId, status: updated.status } };
  }

  async adminListOrders() {
    const rows = await getPrisma().manualPaymentOrder.findMany({
      where: { status: { in: ['awaiting_payment', 'proof_uploaded'] } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      data: rows.map((o) => ({
        id: o.id,
        tenant_id: o.tenantId,
        reference: o.reference,
        provider: o.provider,
        status: o.status,
        plan_code: o.planCode,
        billing_cycle: o.billingCycle,
        amount_inc_vat_cents: o.amountIncVatCents,
        vat_cents: o.vatCents,
        proof_note: o.proofNote,
        proof_file_name: o.proofFileName,
        created_at: o.createdAt.toISOString(),
      })),
    };
  }

  async adminReviewOrder(
    orderId: string,
    actorUserId: string,
    action: 'approve' | 'reject',
    note?: string,
  ) {
    const prisma = getPrisma();
    const order = await prisma.manualPaymentOrder.findUnique({ where: { id: orderId } });
    if (!order)
      throw new DomainError('NOT_FOUND', 'Payment order not found', 404, 'errors.not_found');
    if (action === 'reject') {
      const updated = await prisma.manualPaymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'rejected',
          adminNote: note?.slice(0, 1000) ?? null,
          approvedBy: actorUserId,
        },
      });
      await audit.write({
        actorUserId,
        tenantId: order.tenantId,
        action: 'billing.manual.reject',
        targetType: 'ManualPaymentOrder',
        targetId: order.id,
        afterRef: JSON.stringify({ note: note ?? null, reference: order.reference }),
      });
      return { data: { id: updated.id, status: updated.status } };
    }
    const planCode = requirePlan(order.planCode);
    await this.activatePlan(order.tenantId, actorUserId, {
      planCode,
      billingCycle: asCycle(order.billingCycle),
      provider: order.provider,
      notes: note ?? `Approved manual payment ${order.reference}`,
      reference: order.reference,
      xApiAddon: order.xApiAddon,
      vatRateBps: order.vatRateBps,
    });
    const updated = await prisma.manualPaymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'approved',
        adminNote: note?.slice(0, 1000) ?? null,
        approvedBy: actorUserId,
        approvedAt: new Date(),
      },
    });
    await getPrisma().billingCheckout.updateMany({
      where: { tenantId: order.tenantId, providerRef: order.reference },
      data: { status: 'fulfilled', fulfilledAt: new Date(), fulfilledBy: actorUserId },
    });
    return { data: { id: updated.id, status: updated.status, plan_code: planCode } };
  }

  async getSettings() {
    return { data: await loadBillingSettings() };
  }

  async updateSettings(
    actorUserId: string,
    input: {
      vat_rate_bps?: number;
      grace_period_days?: number;
      trial_days?: number;
      x_api_addon_monthly_usd_cents?: number;
      bank_instructions_en?: string;
      bank_instructions_ar?: string;
    },
  ) {
    const current = await loadBillingSettings();
    const vatRateBps =
      input.vat_rate_bps == null ? current.vatRateBps : Math.round(Number(input.vat_rate_bps));
    if (vatRateBps < 0 || vatRateBps > 5000) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Invalid VAT rate',
        400,
        'errors.validation_failed',
      );
    }
    const row = await getPrisma().billingSettings.upsert({
      where: { id: 'platform' },
      create: {
        id: 'platform',
        vatRateBps,
        gracePeriodDays: input.grace_period_days ?? current.gracePeriodDays,
        trialDays: input.trial_days ?? current.trialDays,
        xApiAddonMonthlyUsdCents:
          input.x_api_addon_monthly_usd_cents ?? current.xApiAddonMonthlyUsdCents,
        bankInstructionsEn: input.bank_instructions_en ?? current.bankInstructionsEn,
        bankInstructionsAr: input.bank_instructions_ar ?? current.bankInstructionsAr,
      },
      update: {
        vatRateBps,
        gracePeriodDays: input.grace_period_days ?? current.gracePeriodDays,
        trialDays: input.trial_days ?? current.trialDays,
        xApiAddonMonthlyUsdCents:
          input.x_api_addon_monthly_usd_cents ?? current.xApiAddonMonthlyUsdCents,
        bankInstructionsEn: input.bank_instructions_en ?? current.bankInstructionsEn,
        bankInstructionsAr: input.bank_instructions_ar ?? current.bankInstructionsAr,
      },
    });
    await audit.write({
      actorUserId,
      action: 'billing.settings.update',
      targetType: 'BillingSettings',
      targetId: 'platform',
      afterRef: JSON.stringify({ vatRateBps: row.vatRateBps }),
    });
    return { data: await loadBillingSettings() };
  }
}

export const billingService = new BillingService();
