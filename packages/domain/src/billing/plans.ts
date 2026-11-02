/**
 * Single source of truth for OMA plans & pricing (Planable-inspired).
 * Seeded into Plan / PlanLimit / PlanFeature; Subscription per tenant references planCode.
 * Payment is deferred — prices are shown as "coming soon"; admins change plans manually.
 */

export const PLAN_CODES = ['free', 'basic', 'pro', 'enterprise'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/** null = unlimited */
export type PlanLimits = {
  brands: number | null;
  social_channels: number | null;
  seats: number | null;
  guests: number | null;
  /** Paid plans: posts created in the current calendar month. Free uses posts_total instead. */
  posts_per_month: number | null;
  /** Free only: lifetime posts created (never resets). null on paid plans. */
  posts_total: number | null;
  storage_bytes: number | null;
  /** Highest approval mode: 1=optional, 2=required, 3=multi_level */
  approval_level: number;
  ai_runs_per_month: number | null;
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
  /** USD per workspace / month (list price). null = contact sales. */
  priceMonthlyUsd: number | null;
  /** USD per workspace / month when billed yearly (Planable-style ~10/12). */
  priceYearlyPerMonthUsd: number | null;
  popular?: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
};

const GB = 1024 * 1024 * 1024;

export const PLAN_CATALOG: Record<PlanCode, PlanDefinition> = {
  free: {
    code: 'free',
    nameEn: 'Free',
    nameAr: 'مجانية',
    descriptionEn: 'Try OMA with your first posts — no card required.',
    descriptionAr: 'جرّب OMA بمنشوراتك الأولى — دون بطاقة.',
    priceMonthlyUsd: 0,
    priceYearlyPerMonthUsd: 0,
    limits: {
      brands: 1,
      social_channels: 2,
      seats: 3,
      guests: 1,
      posts_per_month: null,
      posts_total: 50,
      storage_bytes: 2 * GB,
      approval_level: 1,
      ai_runs_per_month: 0,
    },
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
      ai_assist: false,
      workdrive: true,
    },
  },
  basic: {
    code: 'basic',
    nameEn: 'Basic',
    nameAr: 'أساسية',
    descriptionEn: 'For small teams planning content together.',
    descriptionAr: 'للفرق الصغيرة التي تخطّط المحتوى معاً.',
    priceMonthlyUsd: 39,
    priceYearlyPerMonthUsd: 33,
    limits: {
      brands: 3,
      social_channels: 4,
      seats: 10,
      guests: 5,
      posts_per_month: 60,
      posts_total: null,
      storage_bytes: 10 * GB,
      approval_level: 1,
      ai_runs_per_month: 20,
    },
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
    nameAr: 'احترافية',
    descriptionEn: 'For growing teams with approvals, clients, and analytics.',
    descriptionAr: 'للفرق النامية مع الموافقات والعملاء والتحليلات.',
    priceMonthlyUsd: 59,
    priceYearlyPerMonthUsd: 49,
    popular: true,
    limits: {
      brands: 10,
      social_channels: 10,
      seats: null,
      guests: 25,
      posts_per_month: 150,
      posts_total: null,
      storage_bytes: 50 * GB,
      approval_level: 2,
      ai_runs_per_month: 200,
    },
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
  enterprise: {
    code: 'enterprise',
    nameEn: 'Enterprise',
    nameAr: 'مؤسسات',
    descriptionEn: 'Unlimited scale, multi-level approvals, and custom roles.',
    descriptionAr: 'نطاق غير محدود، موافقات متعددة المستويات وأدوار مخصصة.',
    priceMonthlyUsd: null,
    priceYearlyPerMonthUsd: null,
    limits: {
      brands: null,
      social_channels: null,
      seats: null,
      guests: null,
      posts_per_month: null,
      posts_total: null,
      storage_bytes: 100 * GB,
      approval_level: 3,
      ai_runs_per_month: null,
    },
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

/** New workspaces start here. */
export const DEFAULT_PLAN_FOR_NEW_TENANTS: PlanCode = 'free';

/**
 * Existing tenants (pre-plans rollout) are grandfathered to Pro so demos and
 * production workspaces keep current limits/features until an admin changes them.
 */
export const GRANDFATHER_PLAN_FOR_EXISTING: PlanCode = 'pro';

export type PlanLimitKey = keyof PlanLimits;
export type PlanFeatureKey = keyof PlanFeatures;

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === 'string' && (PLAN_CODES as readonly string[]).includes(v);
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

export const PLAN_LIMIT_MESSAGES: Record<
  string,
  { en: string; ar: string; messageKey: string }
> = {
  brands: {
    en: 'You’ve reached the brand limit for your plan. Upgrade to add more brands.',
    ar: 'وصلت إلى حد العلامات في خطتك. رقِّ الخطة لإضافة المزيد.',
    messageKey: 'errors.plan_limit.brands',
  },
  social_channels: {
    en: 'You’ve reached the social channel limit for your plan. Upgrade to connect more channels.',
    ar: 'وصلت إلى حد القنوات الاجتماعية في خطتك. رقِّ الخطة لربط المزيد.',
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
  posts_per_month: {
    en: 'You’ve used all posts allowed this month on your plan. Upgrade or wait until next month.',
    ar: 'استهلكت كل منشورات هذا الشهر في خطتك. رقِّ الخطة أو انتظر الشهر القادم.',
    messageKey: 'errors.plan_limit.posts_per_month',
  },
  posts_total: {
    en: 'You’ve used all free posts. Upgrade to keep creating content.',
    ar: 'استهلكت كل المنشورات المجانية. رقِّ الخطة لمتابعة إنشاء المحتوى.',
    messageKey: 'errors.plan_limit.posts_total',
  },
  storage_bytes: {
    en: 'You’ve reached Work Drive storage for your plan. Upgrade for more space.',
    ar: 'وصلت إلى حد تخزين مساحة العمل في خطتك. رقِّ الخطة لمساحة أكبر.',
    messageKey: 'errors.plan_limit.storage_bytes',
  },
  ai_runs_per_month: {
    en: 'You’ve used all AI assists for this month. Upgrade for a higher limit.',
    ar: 'استهلكت كل مساعدات الذكاء الاصطناعي لهذا الشهر. رقِّ الخطة لحد أعلى.',
    messageKey: 'errors.plan_limit.ai_runs_per_month',
  },
};

export const PLAN_FEATURE_MESSAGES: Record<
  string,
  { en: string; ar: string; messageKey: string }
> = {
  analytics: {
    en: 'Analytics is available on Pro and Enterprise. Request an upgrade to unlock it.',
    ar: 'التحليلات متاحة في الخطط الاحترافية والمؤسسات. اطلب ترقية لتفعيلها.',
    messageKey: 'errors.plan_feature.analytics',
  },
  client_visibility: {
    en: 'Hiding posts from clients is available on Pro and Enterprise.',
    ar: 'إخفاء المنشورات عن العملاء متاح في الخطط الاحترافية والمؤسسات.',
    messageKey: 'errors.plan_feature.client_visibility',
  },
  approvals_required: {
    en: 'Required approvals are available on Pro and Enterprise.',
    ar: 'الموافقات الإلزامية متاحة في الخطط الاحترافية والمؤسسات.',
    messageKey: 'errors.plan_feature.approvals_required',
  },
  approvals_multi_level: {
    en: 'Multi-level approvals are available on Enterprise.',
    ar: 'الموافقات متعددة المستويات متاحة في خطة المؤسسات.',
    messageKey: 'errors.plan_feature.approvals_multi_level',
  },
  grid_view: {
    en: 'Grid view is available on Pro and Enterprise.',
    ar: 'عرض الشبكة متاح في الخطط الاحترافية والمؤسسات.',
    messageKey: 'errors.plan_feature.grid_view',
  },
  list_view: {
    en: 'List view is available on Enterprise.',
    ar: 'عرض القائمة متاح في خطة المؤسسات.',
    messageKey: 'errors.plan_feature.list_view',
  },
  custom_roles: {
    en: 'Custom roles are available on Enterprise.',
    ar: 'الأدوار المخصصة متاحة في خطة المؤسسات.',
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
