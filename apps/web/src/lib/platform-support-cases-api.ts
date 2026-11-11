import { api } from './api';

export type OperatorCase = {
  id: string;
  tenant_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  tenant?: { id: string; name: string; slug: string };
  messages?: Array<{
    id: string;
    author_name: string;
    author_kind: string;
    body: string;
    internal?: boolean;
    created_at: string;
  }>;
};

export function supportListCases(params?: { status?: string; q?: string }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs}` : '';
  return api<{ data: OperatorCase[] }>(`/api/v1/support/cases${suffix}`);
}

export function supportGetCase(caseId: string) {
  return api<{ data: OperatorCase }>(`/api/v1/support/cases/${caseId}`);
}

export function supportReplyCase(
  caseId: string,
  body: { message: string; internal?: boolean; status?: string },
) {
  return api<{ data: OperatorCase }>(`/api/v1/support/cases/${caseId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
