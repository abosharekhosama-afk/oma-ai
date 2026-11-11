import { api } from './api';

export type HelpdeskCase = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  messages?: Array<{
    id: string;
    author_name: string;
    author_kind: string;
    body: string;
    created_at: string;
  }>;
};

export function listHelpdeskCases() {
  return api<{ data: HelpdeskCase[] }>('/api/v1/helpdesk/cases');
}

export function createHelpdeskCase(body: { subject: string; message: string }) {
  return api<{ data: HelpdeskCase }>('/api/v1/helpdesk/cases', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getHelpdeskCase(caseId: string) {
  return api<{ data: HelpdeskCase }>(`/api/v1/helpdesk/cases/${caseId}`);
}

export function replyHelpdeskCase(caseId: string, message: string) {
  return api<{ data: HelpdeskCase }>(`/api/v1/helpdesk/cases/${caseId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
