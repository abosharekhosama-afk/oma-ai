import { api } from './api';

export type PlanDto = {
  code: string;
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  price_monthly_usd: number | null;
  price_yearly_per_month_usd: number | null;
  popular?: boolean;
  limits: Record<string, number | null>;
  features: Record<string, boolean>;
  payment_deferred?: boolean;
};

export type SubscriptionView = {
  tenant_id: string;
  plan_code: string;
  billing_cycle: string;
  status: string;
  grandfathered: boolean;
  payment_deferred: boolean;
  payment_coming_soon: boolean;
  started_at: string;
  plan: PlanDto;
  usage: Record<string, number>;
  usage_bars: Array<{
    key: string;
    used: number;
    limit: number | null;
    unlimited: boolean;
    pct: number;
  }>;
};

export function listPlans() {
  return api<{ data: PlanDto[]; payment_coming_soon?: boolean }>('/api/v1/billing/plans');
}

export function getSubscription() {
  return api<{ data: SubscriptionView }>('/api/v1/billing/subscription');
}

export function requestUpgrade(body: { plan_code: string; billing_cycle?: string; note?: string }) {
  return api<{ data: { id: string; message: { en: string; ar: string } } }>(
    '/api/v1/billing/upgrade-requests',
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function changePlan(body: { plan_code: string; billing_cycle?: string; notes?: string }) {
  return api<{ data: { plan_code: string } }>('/api/v1/billing/subscription', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function listUpgradeRequests() {
  return api<{ data: Array<Record<string, unknown>> }>('/api/v1/billing/upgrade-requests');
}

/** Parse plan-limit / plan-feature API errors for bilingual UI. */
export function planErrorFromUnknown(err: unknown, isAr: boolean): string | null {
  const e = err as {
    code?: string;
    message?: string;
    message_key?: string;
    details?: Array<{ message_ar?: string; limit_key?: string; feature?: string }>;
  } | null;
  if (!e) return null;
  if (e.code !== 'PLAN_LIMIT_REACHED' && e.code !== 'PLAN_FEATURE_REQUIRED') return null;
  const detail = Array.isArray(e.details) ? e.details[0] : undefined;
  if (isAr && detail?.message_ar) return detail.message_ar;
  return e.message || null;
}
