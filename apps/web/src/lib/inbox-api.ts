import { api } from './api';

export type InboxConversationListItem = {
  id: string;
  platform: string;
  type: string;
  status: string;
  sentiment: string | null;
  assignedToUserId: string | null;
  participantName: string | null;
  participantAvatar: string | null;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  messageCount: number;
  unreadCount: number;
  subject: string | null;
  brandId: string | null;
};

export type InboxMessage = {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderName: string;
  senderAvatar: string | null;
  senderExternalId: string;
  content: string;
  mediaUrls: string[];
  createdAt: string;
};

export type InboxNote = {
  id: string;
  authorUserId: string;
  content: string;
  createdAt: string;
};

export type InboxConversationDetail = {
  id: string;
  platform: string;
  type: string;
  status: string;
  sentiment: string | null;
  assignedToUserId: string | null;
  participantName: string | null;
  participantAvatar: string | null;
  participantExtId: string | null;
  subject: string | null;
  brandId: string | null;
  messageCount: number;
  messages: InboxMessage[];
  notes: InboxNote[];
};

export function listInboxConversations(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== 'all') qs.set(k, String(v));
  }
  const q = qs.toString();
  return api<{ page: number; limit: number; total: number; items: InboxConversationListItem[] }>(
    `/api/v1/inbox/conversations${q ? `?${q}` : ''}`,
  );
}

export function getInboxConversation(id: string) {
  return api<InboxConversationDetail>(`/api/v1/inbox/conversations/${id}`);
}

export function replyInboxConversation(id: string, content: string) {
  return api<{ id: string; externalDelivered: boolean; note: string | null }>(
    `/api/v1/inbox/conversations/${id}/reply`,
    { method: 'POST', body: JSON.stringify({ content }) },
  );
}

export function assignInboxConversation(id: string, assignedToUserId: string | null) {
  return api(`/api/v1/inbox/conversations/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignedToUserId }),
  });
}

export function addInboxNote(id: string, content: string) {
  return api(`/api/v1/inbox/conversations/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function setInboxStatus(id: string, status: string) {
  return api(`/api/v1/inbox/conversations/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}
