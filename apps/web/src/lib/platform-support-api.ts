import { api } from './api';

export function supportLookup(q: string, type?: string, tenantId?: string) {
  const qs = new URLSearchParams({ q });
  if (type) qs.set('type', type);
  if (tenantId) qs.set('tenant_id', tenantId);
  return api<{
    data: {
      users: Array<{
        id: string;
        email: string;
        name: string;
        status: string;
        system_role: string;
      }>;
      tenants: Array<{
        id: string;
        name: string;
        slug: string;
        status: string;
        plan_code: string | null;
      }>;
      brands: Array<{ id: string; tenant_id: string; name: string; status: string }>;
    };
  }>(`/api/v1/support/lookup?${qs}`);
}

export function supportTenantSocial(tenantId: string) {
  return api<{ data: Array<Record<string, unknown>> }>(
    `/api/v1/support/tenants/${tenantId}/social`,
  );
}

export function supportTenantStorage(tenantId: string) {
  return api<{ data: Record<string, unknown> }>(`/api/v1/support/tenants/${tenantId}/storage`);
}

export function supportPublishingFailures(tenantId?: string) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return api<{ data: Array<Record<string, unknown>> }>(`/api/v1/support/publishing/failures${qs}`);
}

export function supportRetryPublish(publishTargetId: string) {
  return api<{ data: { enqueued_jobs: number } }>(
    `/api/v1/support/publishing/${publishTargetId}/retry`,
    { method: 'POST', body: '{}' },
  );
}

export function supportStartImpersonation(body: {
  target_user_id: string;
  tenant_id: string;
  reason: string;
}) {
  return api<{
    data: { impersonation_id: string; expires_at: string; assume_url: string };
  }>('/api/v1/support/impersonate', { method: 'POST', body: JSON.stringify(body) });
}

export function supportAssumeImpersonation(impersonationId: string) {
  return api<{ data: { redirect_url: string; tenant_id: string } }>(
    `/api/v1/support/impersonate/${impersonationId}/assume`,
    { method: 'POST', body: '{}' },
  );
}
