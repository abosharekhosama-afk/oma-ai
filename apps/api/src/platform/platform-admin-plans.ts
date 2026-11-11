import { getPrisma, hydratePlan } from '@oma/db';
import {
  canonicalLimitKey,
  DomainError,
  newId,
  normalizePlanCode,
  PLAN_CODES,
  type PlanCode,
  type PlanLimitKey,
} from '@oma/domain';
import type { AuditService } from '../audit/audit.service';

const EDITABLE_LIMIT_KEYS: PlanLimitKey[] = [
  'brands',
  'social_accounts',
  'seats',
  'guests',
  'scheduled_posts_per_month',
  'storage_bytes',
  'approval_level',
  'ai_credits_per_month',
  'listening_keywords',
  'mentions_per_month',
];

const LIMIT_ALIASES: Partial<Record<PlanLimitKey, PlanLimitKey>> = {
  social_accounts: 'social_channels',
  scheduled_posts_per_month: 'posts_per_month',
  ai_credits_per_month: 'ai_runs_per_month',
};

function assertPlanCode(code: string): PlanCode {
  const normalized = normalizePlanCode(code);
  if (!normalized || !(PLAN_CODES as readonly string[]).includes(normalized)) {
    throw new DomainError('NOT_FOUND', 'Plan not found', 404, 'errors.not_found');
  }
  return normalized;
}

export async function listAdminPlans() {
  const plans = await Promise.all(PLAN_CODES.map((code) => hydratePlan(code)));
  return {
    data: plans.map((p) => ({
      code: p.code,
      name_en: p.nameEn,
      name_ar: p.nameAr,
      price_monthly_usd_cents: Math.round(p.priceMonthlyUsd * 100),
      price_yearly_per_month_usd_cents: Math.round(p.priceYearlyPerMonthUsd * 100),
      popular: Boolean(p.popular),
      limits: Object.fromEntries(
        EDITABLE_LIMIT_KEYS.map((k) => [
          k,
          p.limits[k] != null && k === 'storage_bytes' ? String(p.limits[k]) : p.limits[k],
        ]),
      ),
    })),
  };
}

async function ensurePlanRow(code: PlanCode) {
  const prisma = getPrisma();
  const row = await prisma.plan.findUnique({ where: { code } });
  if (row) return row;
  const fallback = await hydratePlan(code);
  return prisma.plan.create({
    data: {
      id: newId(),
      code,
      nameEn: fallback.nameEn,
      nameAr: fallback.nameAr,
      descriptionEn: fallback.descriptionEn,
      descriptionAr: fallback.descriptionAr,
      priceMonthlyUsdCents: Math.round(fallback.priceMonthlyUsd * 100),
      priceYearlyPerMonthCents: Math.round(fallback.priceYearlyPerMonthUsd * 100),
      popular: fallback.popular ?? false,
      active: true,
    },
  });
}

async function upsertLimit(planId: string, key: string, value: number | null) {
  const prisma = getPrisma();
  const valueJson = JSON.stringify(value);
  const existing = await prisma.planLimit.findUnique({
    where: { planId_key: { planId, key } },
  });
  if (existing) {
    await prisma.planLimit.update({
      where: { id: existing.id },
      data: { valueJson },
    });
    return;
  }
  await prisma.planLimit.create({
    data: { id: newId(), planId, key, valueJson },
  });
}

export async function patchAdminPlan(
  audit: AuditService,
  actorUserId: string,
  planCode: string,
  body: {
    price_monthly_usd_cents?: number;
    price_yearly_per_month_usd_cents?: number;
    name_en?: string;
    name_ar?: string;
    popular?: boolean;
    active?: boolean;
    limits?: Record<string, number | string | null>;
  },
  correlationId?: string,
) {
  const code = assertPlanCode(planCode);
  const planRow = await ensurePlanRow(code);
  const prisma = getPrisma();
  const planUpdates: {
    priceMonthlyUsdCents?: number;
    priceYearlyPerMonthCents?: number;
    nameEn?: string;
    nameAr?: string;
    popular?: boolean;
    active?: boolean;
  } = {};
  if (body.price_monthly_usd_cents != null) {
    planUpdates.priceMonthlyUsdCents = Math.max(0, Math.floor(body.price_monthly_usd_cents));
  }
  if (body.price_yearly_per_month_usd_cents != null) {
    planUpdates.priceYearlyPerMonthCents = Math.max(0, Math.floor(body.price_yearly_per_month_usd_cents));
  }
  if (body.name_en?.trim()) planUpdates.nameEn = body.name_en.trim();
  if (body.name_ar?.trim()) planUpdates.nameAr = body.name_ar.trim();
  if (typeof body.popular === 'boolean') planUpdates.popular = body.popular;
  if (typeof body.active === 'boolean') planUpdates.active = body.active;
  if (Object.keys(planUpdates).length) {
    await prisma.plan.update({ where: { id: planRow.id }, data: planUpdates });
  }

  if (body.limits && typeof body.limits === 'object') {
    for (const [rawKey, rawVal] of Object.entries(body.limits)) {
      const key = canonicalLimitKey(rawKey);
      if (!(EDITABLE_LIMIT_KEYS as readonly string[]).includes(key)) continue;
      let value: number | null;
      if (rawVal === null || rawVal === '' || rawVal === 'unlimited') {
        value = null;
      } else {
        const n = typeof rawVal === 'string' ? Number(rawVal) : rawVal;
        if (!Number.isFinite(n) || n < 0) {
          throw new DomainError(
            'VALIDATION_FAILED',
            `Invalid limit ${key}`,
            400,
            'errors.validation_failed',
          );
        }
        value = Math.floor(n);
      }
      await upsertLimit(planRow.id, key, value);
      const alias = LIMIT_ALIASES[key];
      if (alias) await upsertLimit(planRow.id, alias, value);
    }
  }

  await audit.write({
    actorUserId,
    actorType: 'SUPER_ADMIN',
    action: 'platform.plan.updated',
    targetType: 'Plan',
    targetId: planRow.id,
    afterRef: JSON.stringify({ code, ...body }),
    correlationId,
  });

  const hydrated = await hydratePlan(code);
  return {
    data: {
      code: hydrated.code,
      name_en: hydrated.nameEn,
      name_ar: hydrated.nameAr,
      price_monthly_usd_cents: Math.round(hydrated.priceMonthlyUsd * 100),
      price_yearly_per_month_usd_cents: Math.round(hydrated.priceYearlyPerMonthUsd * 100),
      popular: Boolean(hydrated.popular),
      limits: Object.fromEntries(
        EDITABLE_LIMIT_KEYS.map((k) => [
          k,
          hydrated.limits[k] != null && k === 'storage_bytes'
            ? String(hydrated.limits[k])
            : hydrated.limits[k],
        ]),
      ),
    },
  };
}
