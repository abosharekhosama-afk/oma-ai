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
  vat_rate_bps?: number;
  vat_percent?: string;
  monthly_vat?: {
    ex_vat_cents: number;
    vat_cents: number;
    inc_vat_cents: number;
  };
};

export type ProviderDto = {
  id: string;
  name_en: string;
  name_ar: string;
  mode: 'live' | 'manual' | 'unavailable';
  configured: boolean;
  notes_en: string;
  notes_ar: string;
};

export type InvoiceDto = {
  id: string;
  provider: string;
  number: string | null;
  status: string;
  currency: string;
  amount_ex_vat_cents: number;
  vat_rate_bps: number;
  vat_cents: number;
  amount_inc_vat_cents: number;
  hosted_url: string | null;
  pdf_url: string | null;
  created_at: string;
  paid_at: string | null;
};

export type SubscriptionView = {
  tenant_id: string;
  plan_code: string;
  billing_cycle: string;
  status: string;
  grandfathered: boolean;
  payment_deferred: boolean;
  payment_configured?: boolean;
  payment_coming_soon: boolean;
  provider?: string | null;
  x_api_addon?: boolean;
  vat_rate_bps?: number;
  vat_percent?: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  pending_plan_code?: string | null;
  grace_period_ends_at?: string | null;
  trial_ends_at?: string | null;
  started_at: string;
  has_stripe_portal?: boolean;
  plan: PlanDto;
  usage: Record<string, number>;
  usage_bars: Array<{
    key: string;
    used: number;
    limit: number | null;
    unlimited: boolean;
    pct: number;
  }>;
  invoices?: InvoiceDto[];
  providers?: ProviderDto[];
  addon?: { code: string; price_monthly_usd: number };
};

export function listPlans() {
  return api<{ data: PlanDto[] }>('/api/v1/billing/plans');
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

export function startCheckout(body: {
  plan_code: string;
  billing_cycle?: string;
  provider?: string;
  x_api_addon?: boolean;
  note?: string;
}) {
  return api<{
    data: {
      id?: string;
      status: string;
      plan_code: string;
      provider?: string;
      payment_configured: boolean;
      redirect_url?: string | null;
      reference?: string;
      instructions?: { en: string; ar: string };
      amount_inc_vat_cents?: number;
      vat_cents?: number;
      vat_percent?: string;
      fallback_from?: string | null;
      message?: { en: string; ar: string };
    };
  }>('/api/v1/billing/checkouts', { method: 'POST', body: JSON.stringify(body) });
}

export type CheckoutDto = {
  id: string;
  plan_code: string;
  billing_cycle: string;
  amount_usd_cents: number | null;
  status: string;
  provider: string;
  created_at: string;
};

export function listCheckouts() {
  return api<{
    data: CheckoutDto[];
    orders?: Array<Record<string, unknown>>;
    payment_configured: boolean;
  }>('/api/v1/billing/checkouts');
}

export function cancelCheckout(id: string) {
  return api<{ data: { id: string; status: string } }>(`/api/v1/billing/checkouts/${id}/cancel`, {
    method: 'POST',
    body: '{}',
  });
}

export function submitPaymentProof(body: {
  reference?: string;
  order_id?: string;
  proof_note: string;
  proof_file_name?: string;
}) {
  return api<{ data: { id: string; status: string; reference: string } }>(
    '/api/v1/billing/manual-orders/proof',
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function openBillingPortal() {
  return api<{ data: { redirect_url: string } }>('/api/v1/billing/portal', {
    method: 'POST',
    body: '{}',
  });
}

export function cancelSubscriptionAtPeriodEnd() {
  return api<{ data: { cancel_at_period_end: boolean } }>('/api/v1/billing/subscription/cancel', {
    method: 'POST',
    body: '{}',
  });
}

export function resumeSubscription() {
  return api<{ data: { cancel_at_period_end: boolean } }>('/api/v1/billing/subscription/resume', {
    method: 'POST',
    body: '{}',
  });
}

export function adminListWorkspaces(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return api<{ data: Array<Record<string, unknown>> }>(`/api/v1/admin/billing/workspaces${qs}`);
}

export function adminListOrders() {
  return api<{ data: Array<Record<string, unknown>> }>('/api/v1/admin/billing/orders');
}

export function adminBillingSettings() {
  return api<{ data: Record<string, unknown> }>('/api/v1/admin/billing/settings');
}

export function adminUpdateSettings(body: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>('/api/v1/admin/billing/settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminActivateWorkspace(tenantId: string, body: Record<string, unknown>) {
  return api<{ data: Record<string, unknown> }>(
    `/api/v1/admin/billing/workspaces/${tenantId}/activate`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function adminExtendWorkspace(tenantId: string, body: { days: number; note?: string }) {
  return api<{ data: Record<string, unknown> }>(
    `/api/v1/admin/billing/workspaces/${tenantId}/extend`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function adminCancelWorkspace(tenantId: string, body: { note?: string }) {
  return api<{ data: Record<string, unknown> }>(
    `/api/v1/admin/billing/workspaces/${tenantId}/cancel`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function adminReviewOrder(id: string, action: 'approve' | 'reject', note?: string) {
  return api<{ data: Record<string, unknown> }>(`/api/v1/admin/billing/orders/${id}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export function planErrorFromUnknown(err: unknown, isAr: boolean): string | null {
  const raw = err as {
    code?: string;
    message?: string;
    details?: Array<{ message_ar?: string; provider?: string }>;
    data?: {
      error?: {
        code?: string;
        message?: string;
        message_key?: string;
        details?: Array<{ message_ar?: string; provider?: string }>;
      };
    };
  } | null;
  if (!raw) return null;
  const nested = raw.data?.error;
  const code = raw.code ?? nested?.code;
  const details = raw.details ?? nested?.details;
  const detail = Array.isArray(details) ? details[0] : undefined;
  if (isAr && detail?.message_ar) return detail.message_ar;
  if (code === 'PROVIDER_NOT_CONFIGURED') {
    if (detail?.provider === 'stripe' || nested?.message_key === 'errors.stripe_not_configured') {
      return isAr ? 'لم يتم إعداد Stripe بعد' : 'Stripe is not set up yet';
    }
    if (detail?.provider === 'lahza' || nested?.message_key === 'errors.lahza_not_configured') {
      return isAr
        ? 'لم يتم إعداد لحظة / بنك فلسطين بعد'
        : 'Lahza / Bank of Palestine is not set up yet';
    }
    return isAr ? 'طريقة الدفع هذه غير مهيأة بعد' : 'That payment method is not set up yet';
  }
  if (
    code &&
    [
      'PLAN_LIMIT_REACHED',
      'PLAN_FEATURE_REQUIRED',
      'PLAN_INACTIVE',
      'ADDON_REQUIRED',
      'PAYMENT_REQUIRED',
    ].includes(code)
  ) {
    return raw.message || nested?.message || null;
  }
  return raw.message || nested?.message || null;
}
