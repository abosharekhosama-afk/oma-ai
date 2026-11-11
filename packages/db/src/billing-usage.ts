import {
  DomainError,
  PERIOD_USAGE_KEYS,
  PLAN_LIMIT_MESSAGES,
  addDays,
  canonicalLimitKey,
  getPlan,
  isPeriodUsageKey,
  normalizePlanCode,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_PLAN_FOR_NEW_TENANTS,
  type PlanCode,
  type PlanDefinition,
  type PlanLimitKey,
} from '@oma/domain';
import { newId } from '@oma/domain';
import { getPrisma } from './prisma.service';

export type UsageSnapshot = {
  brands: number;
  social_accounts: number;
  social_channels: number;
  seats: number;
  guests: number;
  scheduled_posts_per_month: number;
  posts_per_month: number;
  posts_total: number;
  storage_bytes: number;
  ai_credits_per_month: number;
  ai_runs_per_month: number;
  listening_keywords: number;
  mentions_per_month: number;
};

const WRITE_STATUSES = new Set(['trialing', 'active']);

export function periodStartOf(sub: { currentPeriodStart: Date | null }): Date {
  if (sub.currentPeriodStart) {
    return new Date(
      Date.UTC(
        sub.currentPeriodStart.getUTCFullYear(),
        sub.currentPeriodStart.getUTCMonth(),
        sub.currentPeriodStart.getUTCDate(),
      ),
    );
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function subscriptionAllowsUsage(sub: {
  status: string;
  gracePeriodEndsAt?: Date | null;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
}): { ok: true } | { ok: false; reason: 'inactive' | 'past_due' } {
  if (WRITE_STATUSES.has(sub.status)) {
    if (sub.status === 'trialing' && sub.trialEndsAt && sub.trialEndsAt.getTime() < Date.now()) {
      return { ok: false, reason: 'inactive' };
    }
    return { ok: true };
  }
  if (sub.status === 'past_due') {
    const until = sub.gracePeriodEndsAt;
    if (until && until.getTime() >= Date.now()) return { ok: true };
    return { ok: false, reason: 'past_due' };
  }
  return { ok: false, reason: 'inactive' };
}

export async function loadBillingSettings() {
  const prisma = getPrisma();
  const row = await prisma.billingSettings.findUnique({ where: { id: 'platform' } });
  return {
    vatRateBps: row?.vatRateBps ?? 1700,
    gracePeriodDays: row?.gracePeriodDays ?? DEFAULT_GRACE_PERIOD_DAYS,
    trialDays: row?.trialDays ?? 14,
    currency: row?.currency ?? 'usd',
    xApiAddonMonthlyUsdCents: row?.xApiAddonMonthlyUsdCents ?? 2900,
    bankInstructionsEn: row?.bankInstructionsEn ?? null,
    bankInstructionsAr: row?.bankInstructionsAr ?? null,
    bankTransferAccountNumber: row?.bankTransferAccountNumber ?? null,
  };
}

export async function hydratePlan(code: string): Promise<PlanDefinition> {
  const normalized = normalizePlanCode(code) ?? DEFAULT_PLAN_FOR_NEW_TENANTS;
  const fallback = getPlan(normalized);
  const prisma = getPrisma();
  const row = await prisma.plan.findUnique({
    where: { code: normalized },
    include: { limits: true, features: true },
  });
  if (!row) return fallback;
  const limits = { ...fallback.limits };
  for (const lim of row.limits) {
    try {
      const parsed = JSON.parse(lim.valueJson) as number | null;
      (limits as Record<string, number | null>)[lim.key] = parsed;
    } catch {
      /* keep catalog */
    }
  }
  const features = { ...fallback.features };
  for (const feat of row.features) {
    (features as Record<string, boolean>)[feat.key] = feat.enabled;
  }
  return {
    ...fallback,
    code: normalized,
    nameEn: row.nameEn || fallback.nameEn,
    nameAr: row.nameAr || fallback.nameAr,
    descriptionEn: row.descriptionEn || fallback.descriptionEn,
    descriptionAr: row.descriptionAr || fallback.descriptionAr,
    priceMonthlyUsd:
      row.priceMonthlyUsdCents != null ? row.priceMonthlyUsdCents / 100 : fallback.priceMonthlyUsd,
    priceYearlyPerMonthUsd:
      row.priceYearlyPerMonthCents != null
        ? row.priceYearlyPerMonthCents / 100
        : fallback.priceYearlyPerMonthUsd,
    popular: row.popular,
    limits,
    features,
  };
}

function parseKeywords(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => String(x ?? '').trim()).length : 0;
  } catch {
    return 0;
  }
}

export async function snapshotUsage(tenantId: string, periodStart: Date): Promise<UsageSnapshot> {
  const prisma = getPrisma();
  const periodEnd = new Date(periodStart.getTime());
  // Display window: the stored billing period start through now/next increment.
  const [
    brands,
    social_accounts,
    seats,
    guests,
    posts_total,
    storageAgg,
    listeningRules,
    counters,
  ] = await Promise.all([
    prisma.brandWorkspace.count({ where: { tenantId, deletedAt: null } }),
    prisma.socialPage.count({ where: { tenantId } }),
    prisma.membership.count({
      where: { tenantId, status: { in: ['ACTIVE', 'INVITED'] }, membershipKind: 'team' },
    }),
    prisma.membership.count({
      where: { tenantId, status: { in: ['ACTIVE', 'INVITED'] }, membershipKind: 'client' },
    }),
    prisma.contentItem.count({ where: { tenantId } }),
    prisma.mediaAsset.aggregate({
      where: { tenantId, status: { not: 'MISSING' }, storageProvider: 'OMA_INTERNAL' },
      _sum: { size: true },
    }),
    prisma.listeningRule.findMany({
      where: { tenantId },
      select: { keywordsJson: true },
    }),
    prisma.billingUsageCounter.findMany({
      where: { tenantId, periodStart },
    }),
  ]);
  const byKey = Object.fromEntries(counters.map((c) => [c.key, c.used]));
  const scheduled = byKey.scheduled_posts_per_month ?? byKey.posts_per_month ?? 0;
  const credits = byKey.ai_credits_per_month ?? byKey.ai_runs_per_month ?? 0;
  const mentions = byKey.mentions_per_month ?? 0;
  const keywords = listeningRules.reduce((n, r) => n + parseKeywords(r.keywordsJson), 0);
  void periodEnd;
  return {
    brands,
    social_accounts,
    social_channels: social_accounts,
    seats,
    guests,
    scheduled_posts_per_month: scheduled,
    posts_per_month: scheduled,
    posts_total,
    storage_bytes: Number(storageAgg._sum.size ?? 0n),
    ai_credits_per_month: credits,
    ai_runs_per_month: credits,
    listening_keywords: keywords,
    mentions_per_month: mentions,
  };
}

export function throwLimit(
  key: string,
  planCode: PlanCode,
  limit: number,
  used: number,
  adding: number,
): never {
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

export function throwInactive(reason: 'inactive' | 'past_due'): never {
  if (reason === 'past_due') {
    throw new DomainError(
      'PLAN_INACTIVE',
      'Your subscription is past due and the grace period has ended. Update billing to continue.',
      402,
      'errors.plan_inactive',
      [
        {
          reason,
          upgrade_path: '/app/billing',
          message_ar: 'انتهت مهلة السماح لاشتراكك المتأخر. حدّث الفوترة للمتابعة.',
        },
      ],
    );
  }
  throw new DomainError(
    'PLAN_INACTIVE',
    'Your workspace does not have an active plan. Choose a plan to continue.',
    402,
    'errors.plan_inactive',
    [
      {
        reason,
        upgrade_path: '/app/billing',
        message_ar: 'لا توجد خطة فعّالة لمساحة العمل. اختر خطة للمتابعة.',
      },
    ],
  );
}

/**
 * Atomically increment a period counter if it stays within `limit`.
 * `limit === null` means unlimited (always increment).
 */
export async function consumePeriodUsage(
  tenantId: string,
  key: string,
  adding: number,
  limit: number | null,
  periodStart: Date,
): Promise<number> {
  const prisma = getPrisma();
  const canonical = canonicalLimitKey(key);
  const id = newId();
  if (limit == null) {
    const rows = await prisma.$queryRaw<Array<{ used: number }>>`
      INSERT INTO "BillingUsageCounter" ("id", "tenantId", "periodStart", "key", "used")
      VALUES (${id}, ${tenantId}, ${periodStart}, ${canonical}, ${adding})
      ON CONFLICT ("tenantId", "periodStart", "key")
      DO UPDATE SET "used" = "BillingUsageCounter"."used" + EXCLUDED."used"
      RETURNING "used"
    `;
    return Number(rows[0]?.used ?? adding);
  }
  const rows = await prisma.$queryRaw<Array<{ used: number }>>`
    INSERT INTO "BillingUsageCounter" ("id", "tenantId", "periodStart", "key", "used")
    SELECT ${id}, ${tenantId}, ${periodStart}, ${canonical}, ${adding}
    WHERE ${adding} <= ${limit}
    ON CONFLICT ("tenantId", "periodStart", "key")
    DO UPDATE SET "used" = "BillingUsageCounter"."used" + EXCLUDED."used"
    WHERE "BillingUsageCounter"."used" + EXCLUDED."used" <= ${limit}
    RETURNING "used"
  `;
  if (!rows.length) {
    const current = await prisma.billingUsageCounter.findUnique({
      where: {
        tenantId_periodStart_key: { tenantId, periodStart, key: canonical },
      },
    });
    return -(current?.used ?? 0); // negative signals overflow; caller throws
  }
  return Number(rows[0]!.used);
}

export { PERIOD_USAGE_KEYS, isPeriodUsageKey, addDays };
export type { PlanCode, PlanLimitKey };

export async function enforceAndConsumeUsage(tenantId: string, key: string, adding = 1) {
  const prisma = getPrisma();
  const sub = await prisma.workspaceSubscription.findUnique({ where: { tenantId } });
  if (!sub) throwInactive('inactive');
  const access = subscriptionAllowsUsage(sub);
  if (!access.ok) throwInactive(access.reason);
  const planCode = normalizePlanCode(sub.planCode) ?? DEFAULT_PLAN_FOR_NEW_TENANTS;
  const plan = await hydratePlan(planCode);
  const canonical = canonicalLimitKey(key);
  const limit = (plan.limits[canonical] ?? null) as number | null;
  const used = await consumePeriodUsage(
    tenantId,
    canonical,
    adding,
    typeof limit === 'number' ? limit : null,
    periodStartOf(sub),
  );
  if (used < 0) throwLimit(key, planCode, typeof limit === 'number' ? limit : 0, -used, adding);
  return { planCode, limit, used };
}
