/**
 * OMA pricing catalog (Starter / Pro / Agency).
 * Seeded into Plan / PlanLimit / PlanFeature so rows can be edited in the database.
 * List prices are USD before VAT.
 */

import { YEARLY_MONTHS_CHARGED } from './vat';

export const PLAN_CODES = ['starter', 'pro', 'agency'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const LEGACY_PLAN_MAP: Record<string, PlanCode> = {
  free: 'starter',
  basic: 'starter',
  enterprise: 'agency',
};

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/** null = unlimited */
export type PlanLimits = {
  brands: number | null;
  social_accounts: number | null;
  /** Alias of social_accounts (older call sites). */
  social_channels: number | null;
  seats: number | null;
  guests: number | null;
  scheduled_posts_per_month: number | null;
  /** Alias of scheduled_posts_per_month. */
  posts_per_month: number | null;
  posts_total: number | null;
  storage_bytes: number | null;
  /** Highest approval mode: 1=optional, 2=required, 3=multi_level */
  approval_level: number;
  ai_credits_per_month: number | null;
  /** Alias of ai_credits_per_month. */
  ai_runs_per_month: number | null;
  listening_keywords: number | null;
  mentions_per_month: number | null;
};

export type PlanFeatures = {
  feed_view: boolean;
  calendar_view: boolean;
  grid_view: boolean;
  list_view: boolean;
  approvals_optional: boolean;
  approvals_required: boolean;
  approvals_multi_level: boolean;
  client_visibility: boolean;
  analytics: boolean;
  custom_roles: boolean;
  publishing: boolean;
  ai_assist: boolean;
  workdrive: boolean;
};

export type PlanDefinition = {
  code: PlanCode;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  /** USD per workspace / month (list price, before VAT). */
  priceMonthlyUsd: number;
  /** USD per workspace / month when billed yearly (before VAT). */
  priceYearlyPerMonthUsd: number;
  popular?: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
};

const GB = 1024 * 1024 * 1024;

function limits(input: {
  brands: number;
  social_accounts: number;
  seats: number;
  guests: number;
  scheduled_posts_per_month: number;
  storage_gb: number;
  approval_level: number;
  ai_credits_per_month: number;
  listening_keywords: number;
  mentions_per_month: number;
}): PlanLimits {
  return {
    brands: input.brands,
    social_accounts: input.social_accounts,
    social_channels: input.social_accounts,
    seats: input.seats,
    guests: input.guests,
    scheduled_posts_per_month: input.scheduled_posts_per_month,
    posts_per_month: input.scheduled_posts_per_month,
    posts_total: null,
    storage_bytes: input.storage_gb * GB,
    approval_level: input.approval_level,
    ai_credits_per_month: input.ai_credits_per_month,
    ai_runs_per_month: input.ai_credits_per_month,
    listening_keywords: input.listening_keywords,
    mentions_per_month: input.mentions_per_month,
  };
}

export const PLAN_CATALOG: Record<PlanCode, PlanDefinition> = {
  starter: {
    code: 'starter',
    nameEn: 'Starter',
    nameAr: 'البداية',
    descriptionEn: 'For small teams publishing together across a few brands.',
    descriptionAr: 'للفرق الصغيرة التي تنشر معاً عبر عدد محدود من العلامات.',
    priceMonthlyUsd: 39,
    priceYearlyPerMonthUsd: (39 * YEARLY_MONTHS_CHARGED) / 12,
    limits: limits({
      brands: 3,
      social_accounts: 4,
      seats: 3,
      guests: 3,
      scheduled_posts_per_month: 60,
      storage_gb: 10,
      approval_level: 1,
      ai_credits_per_month: 300,
      listening_keywords: 3,
      mentions_per_month: 1000,
    }),
    features: {
      feed_view: true,
      calendar_view: true,
      grid_view: false,
      list_view: false,
      approvals_optional: true,
      approvals_required: false,
      approvals_multi_level: false,
      client_visibility: false,
      analytics: false,
      custom_roles: false,
      publishing: true,
      ai_assist: true,
      workdrive: true,
    },
  },
  pro: {
    code: 'pro',
    nameEn: 'Pro',
    nameAr: 'الاحترافية',
    descriptionEn: 'For growing teams that need approvals, clients, and analytics.',
    descriptionAr: 'للفرق النامية التي تحتاج موافقات وعملاء وتحليلات.',
    priceMonthlyUsd: 79,
    priceYearlyPerMonthUsd: (79 * YEARLY_MONTHS_CHARGED) / 12,
    popular: true,
    limits: limits({
      brands: 10,
      social_accounts: 10,
      seats: 10,
      guests: 10,
      scheduled_posts_per_month: 300,
      storage_gb: 50,
      approval_level: 2,
      ai_credits_per_month: 1500,
      listening_keywords: 10,
      mentions_per_month: 5000,
    }),
    features: {
      feed_view: true,
      calendar_view: true,
      grid_view: true,
      list_view: false,
      approvals_optional: true,
      approvals_required: true,
      approvals_multi_level: false,
      client_visibility: true,
      analytics: true,
      custom_roles: false,
      publishing: true,
      ai_assist: true,
      workdrive: true,
    },
  },
  agency: {
    code: 'agency',
    nameEn: 'Agency',
    nameAr: 'الوكالة',
    descriptionEn: 'For agencies running many brands with higher volume and roles.',
    descriptionAr: 'للوكالات التي تدير علامات كثيرة بحجم أعلى وأدوار مخصصة.',
    priceMonthlyUsd: 249,
    priceYearlyPerMonthUsd: (249 * YEARLY_MONTHS_CHARGED) / 12,
    limits: limits({
      brands: 25,
      social_accounts: 30,
      seats: 25,
      guests: 25,
      scheduled_posts_per_month: 1500,
      storage_gb: 200,
      approval_level: 3,
      ai_credits_per_month: 6000,
      listening_keywords: 30,
      mentions_per_month: 25000,
    }),
    features: {
      feed_view: true,
      calendar_view: true,
      grid_view: true,
      list_view: true,
      approvals_optional: true,
      approvals_required: true,
      approvals_multi_level: true,
      client_visibility: true,
      analytics: true,
      custom_roles: true,
      publishing: true,
      ai_assist: true,
      workdrive: true,
    },
  },
};

/** New workspaces start on Starter (trialing when trial days are configured). */
export const DEFAULT_PLAN_FOR_NEW_TENANTS: PlanCode = 'starter';

/** Existing tenants without a row are grandfathered to Pro so current work is not blocked. */
export const GRANDFATHER_PLAN_FOR_EXISTING: PlanCode = 'pro';

export type PlanLimitKey = keyof PlanLimits;
export type PlanFeatureKey = keyof PlanFeatures;

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === 'string' && (PLAN_CODES as readonly string[]).includes(v);
}

export function normalizePlanCode(v: unknown): PlanCode | null {
  if (typeof v !== 'string') return null;
  if (isPlanCode(v)) return v;
  return LEGACY_PLAN_MAP[v] ?? null;
}

export function getPlan(code: PlanCode): PlanDefinition {
  return PLAN_CATALOG[code];
}

export function planHasFeature(code: PlanCode, feature: PlanFeatureKey): boolean {
  return PLAN_CATALOG[code].features[feature];
}

export function approvalModeAllowed(code: PlanCode, mode: string): boolean {
  const level = PLAN_CATALOG[code].limits.approval_level;
  const m = mode.toLowerCase();
  if (m === 'none' || m === 'optional') return level >= 1;
  if (m === 'required') return level >= 2;
  if (m === 'multi_level') return level >= 3;
  return false;
}

export const PLAN_LIMIT_ALIASES: Record<string, PlanLimitKey> = {
  social_channels: 'social_accounts',
  posts_per_month: 'scheduled_posts_per_month',
  ai_runs_per_month: 'ai_credits_per_month',
};

export function canonicalLimitKey(key: string): PlanLimitKey {
  return (PLAN_LIMIT_ALIASES[key] ?? key) as PlanLimitKey;
}

export const PLAN_LIMIT_MESSAGES: Record<string, { en: string; ar: string; messageKey: string }> = {
  brands: {
    en: 'You’ve reached the brand limit for your plan. Upgrade to add more brands.',
    ar: 'وصلت إلى حد العلامات في خطتك. رقِّ الخطة لإضافة المزيد.',
    messageKey: 'errors.plan_limit.brands',
  },
  social_accounts: {
    en: 'You’ve reached the social account limit for your plan. Upgrade to connect more accounts.',
    ar: 'وصلت إلى حد الحسابات الاجتماعية في خطتك. رقِّ الخطة لربط المزيد.',
    messageKey: 'errors.plan_limit.social_accounts',
  },
  social_channels: {
    en: 'You’ve reached the social account limit for your plan. Upgrade to connect more accounts.',
    ar: 'وصلت إلى حد الحسابات الاجتماعية في خطتك. رقِّ الخطة لربط المزيد.',
    messageKey: 'errors.plan_limit.social_channels',
  },
  seats: {
    en: 'You’ve reached the team seat limit for your plan. Upgrade to invite more people.',
    ar: 'وصلت إلى حد مقاعد الفريق في خطتك. رقِّ الخطة لدعوة المزيد.',
    messageKey: 'errors.plan_limit.seats',
  },
  guests: {
    en: 'You’ve reached the guest/client limit for your plan. Upgrade to invite more guests.',
    ar: 'وصلت إلى حد الضيوف/العملاء في خطتك. رقِّ الخطة لدعوة المزيد.',
    messageKey: 'errors.plan_limit.guests',
  },
  scheduled_posts_per_month: {
    en: 'You’ve used all scheduled posts allowed this billing period. Upgrade or wait until it renews.',
    ar: 'استهلكت كل المنشورات المجدولة المسموحة في فترة الفوترة. رقِّ الخطة أو انتظر التجديد.',
    messageKey: 'errors.plan_limit.scheduled_posts_per_month',
  },
  posts_per_month: {
    en: 'You’ve used all scheduled posts allowed this billing period. Upgrade or wait until it renews.',
    ar: 'استهلكت كل المنشورات المجدولة المسموحة في فترة الفوترة. رقِّ الخطة أو انتظر التجديد.',
    messageKey: 'errors.plan_limit.posts_per_month',
  },
  posts_total: {
    en: 'You’ve used all posts included in your plan. Upgrade to keep creating content.',
    ar: 'استهلكت كل المنشورات المشمولة في خطتك. رقِّ الخطة لمتابعة إنشاء المحتوى.',
    messageKey: 'errors.plan_limit.posts_total',
  },
  storage_bytes: {
    en: 'You’ve reached Work Drive storage for your plan. Upgrade for more space.',
    ar: 'وصلت إلى حد تخزين مساحة العمل في خطتك. رقِّ الخطة لمساحة أكبر.',
    messageKey: 'errors.plan_limit.storage_bytes',
  },
  ai_credits_per_month: {
    en: 'You’ve used all AI credits for this billing period. Upgrade for a higher limit.',
    ar: 'استهلكت كل رصيد الذكاء الاصطناعي لفترة الفوترة. رقِّ الخطة لحد أعلى.',
    messageKey: 'errors.plan_limit.ai_credits_per_month',
  },
  ai_runs_per_month: {
    en: 'You’ve used all AI credits for this billing period. Upgrade for a higher limit.',
    ar: 'استهلكت كل رصيد الذكاء الاصطناعي لفترة الفوترة. رقِّ الخطة لحد أعلى.',
    messageKey: 'errors.plan_limit.ai_runs_per_month',
  },
  listening_keywords: {
    en: 'You’ve reached the listening keyword limit for your plan. Upgrade to track more terms.',
    ar: 'وصلت إلى حد كلمات الاستماع في خطتك. رقِّ الخطة لتتبع المزيد.',
    messageKey: 'errors.plan_limit.listening_keywords',
  },
  mentions_per_month: {
    en: 'You’ve reached the monthly mention limit for your plan. Upgrade to ingest more mentions.',
    ar: 'وصلت إلى حد الإشارات الشهري في خطتك. رقِّ الخطة لاستيعاب المزيد.',
    messageKey: 'errors.plan_limit.mentions_per_month',
  },
};

const USAGE_LIMIT_KEYS = [
  'brands',
  'social_accounts',
  'social_channels',
  'seats',
  'guests',
  'scheduled_posts_per_month',
  'posts_per_month',
  'posts_total',
  'storage_bytes',
  'ai_credits_per_month',
  'ai_runs_per_month',
  'listening_keywords',
  'mentions_per_month',
] as const satisfies readonly PlanLimitKey[];

export const PERIOD_USAGE_KEYS = [
  'scheduled_posts_per_month',
  'posts_per_month',
  'ai_credits_per_month',
  'ai_runs_per_month',
  'mentions_per_month',
] as const;

export function isPeriodUsageKey(key: string): boolean {
  return (PERIOD_USAGE_KEYS as readonly string[]).includes(key);
}

/** List price for the whole billing period, in USD cents, before VAT. */
export function planPriceUsdCents(code: PlanCode, cycle: BillingCycle): number {
  const plan = PLAN_CATALOG[code];
  if (cycle === 'yearly') {
    return Math.round(plan.priceMonthlyUsd * YEARLY_MONTHS_CHARGED * 100);
  }
  return Math.round(plan.priceMonthlyUsd * 100);
}

export function addBillingPeriod(start: Date, cycle: BillingCycle): Date {
  const end = new Date(start.getTime());
  const months = cycle === 'yearly' ? 12 : 1;
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + months);
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  return end;
}

/** Limit keys the workspace already exceeds on the target plan. Empty means the change fits. */
export function limitsExceededByUsage(
  planLimits: PlanLimits,
  usage: Partial<Record<string, number>>,
): PlanLimitKey[] {
  const over: PlanLimitKey[] = [];
  const seen = new Set<string>();
  for (const raw of USAGE_LIMIT_KEYS) {
    const key = canonicalLimitKey(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    const limit = planLimits[key] ?? planLimits[raw];
    if (limit == null) continue;
    const used = usage[key] ?? usage[raw] ?? 0;
    if (used > limit) over.push(key);
  }
  return over;
}

export const PLAN_FEATURE_MESSAGES: Record<string, { en: string; ar: string; messageKey: string }> =
  {
    analytics: {
      en: 'Analytics is available on Pro and Agency. Upgrade to unlock it.',
      ar: 'التحليلات متاحة في خطتي الاحترافية والوكالة. رقِّ الخطة لتفعيلها.',
      messageKey: 'errors.plan_feature.analytics',
    },
    client_visibility: {
      en: 'Hiding posts from clients is available on Pro and Agency.',
      ar: 'إخفاء المنشورات عن العملاء متاح في خطتي الاحترافية والوكالة.',
      messageKey: 'errors.plan_feature.client_visibility',
    },
    approvals_required: {
      en: 'Required approvals are available on Pro and Agency.',
      ar: 'الموافقات الإلزامية متاحة في خطتي الاحترافية والوكالة.',
      messageKey: 'errors.plan_feature.approvals_required',
    },
    approvals_multi_level: {
      en: 'Multi-level approvals are available on Agency.',
      ar: 'الموافقات متعددة المستويات متاحة في خطة الوكالة.',
      messageKey: 'errors.plan_feature.approvals_multi_level',
    },
    grid_view: {
      en: 'Grid view is available on Pro and Agency.',
      ar: 'عرض الشبكة متاح في خطتي الاحترافية والوكالة.',
      messageKey: 'errors.plan_feature.grid_view',
    },
    list_view: {
      en: 'List view is available on Agency.',
      ar: 'عرض القائمة متاح في خطة الوكالة.',
      messageKey: 'errors.plan_feature.list_view',
    },
    custom_roles: {
      en: 'Custom roles are available on Agency.',
      ar: 'الأدوار المخصصة متاحة في خطة الوكالة.',
      messageKey: 'errors.plan_feature.custom_roles',
    },
    ai_assist: {
      en: 'AI assist is not included in your current plan. Upgrade to use it.',
      ar: 'مساعد الذكاء الاصطناعي غير مشمول في خطتك الحالية. رقِّ الخطة لاستخدامه.',
      messageKey: 'errors.plan_feature.ai_assist',
    },
    publishing: {
      en: 'Publishing isn’t available on your current plan.',
      ar: 'النشر غير متاح في خطتك الحالية.',
      messageKey: 'errors.plan_feature.publishing',
    },
  };
