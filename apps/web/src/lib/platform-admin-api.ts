import { api } from './api';

export type AdminMetrics = {
  mrr_usd_cents_estimate: number;
  active_subscriptions: number;
  tenants_total: number;
  tenants_active: number;
  tenants_suspended: number;
  workdrive: {
    master_configured: boolean;
    latest_reconcile_at: string | null;
    oma_internal_bytes: string | null;
    platform_used_bytes: string | null;
    platform_limit_bytes: string | null;
    drift_bytes: string | null;
  };
};

export function adminMetricsOverview() {
  return api<{ data: AdminMetrics }>('/api/v1/admin/metrics/overview');
}

export function adminListTenants(params?: { q?: string; cursor?: string; take?: number }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.take) qs.set('take', String(params.take));
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<{
    data: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      plan_code: string | null;
      subscription_status: string | null;
      storage_mode: string;
    }>;
    page: { next_cursor: string | null; size: number };
  }>(`/api/v1/admin/tenants${suffix}`);
}

export function adminTenantDetail(tenantId: string) {
  return api<{ data: Record<string, unknown> }>(`/api/v1/admin/tenants/${tenantId}`);
}

export function adminPatchTenant(tenantId: string, body: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>(`/api/v1/admin/tenants/${tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminSystemSecrets() {
  return api<{
    data: Array<{ key: string; label: string; configured: boolean; source: string }>;
  }>('/api/v1/admin/system/secrets');
}

export type AdminOperator = {
  id: string;
  email: string;
  name: string;
  status: string;
  system_role: string;
  created_at: string;
};

export function adminListOperators(q?: string) {
  const suffix = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  return api<{ data: AdminOperator[] }>(`/api/v1/admin/operators${suffix}`);
}

export function adminCreateOperator(body: {
  email: string;
  name?: string;
  password?: string;
  system_role?: string;
}) {
  return api<{
    data: AdminOperator & { created?: boolean; temporary_password?: string };
  }>('/api/v1/admin/operators', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function adminPatchOperator(userId: string, body: { system_role: string }) {
  return api<{ data: AdminOperator }>(`/api/v1/admin/operators/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export type AdminPlanRow = {
  code: string;
  name_en: string;
  name_ar: string;
  price_monthly_usd_cents: number;
  price_yearly_per_month_usd_cents: number;
  popular: boolean;
  limits: Record<string, number | string | null>;
};

export function adminListPlans() {
  return api<{ data: AdminPlanRow[] }>('/api/v1/admin/plans');
}

export function adminPatchPlan(planCode: string, body: Record<string, unknown>) {
  return api<{ data: AdminPlanRow }>(`/api/v1/admin/plans/${planCode}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
