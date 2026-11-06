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
  priority?: boolean;
  tags?: string[];
  socialPageId?: string | null;
  firstResponseAt?: string | null;
  closedAt?: string | null;
  metadataJson?: string | null;
  lastMessageDirection?: string | null;
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

export type InboxConversationDetail = InboxConversationListItem & {
  participantExtId: string | null;
  messages: InboxMessage[];
  notes: InboxNote[];
};

export type InboxStats = {
  total: number;
  unread: number;
  open: number;
  pending: number;
  closed: number;
  priority: number;
  unassigned: number;
  unanswered?: number;
};

export function getInboxStats(brandId?: string | null) {
  const q = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
  return api<InboxStats>(`/api/v1/inbox/stats${q}`);
}

export function listInboxConversations(
  params: Record<string, string | number | boolean | undefined> = {},
) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === 'all' || v === false) continue;
    qs.set(k, String(v));
  }
  const q = qs.toString();
  return api<{ page: number; limit: number; total: number; items: InboxConversationListItem[] }>(
    `/api/v1/inbox/conversations${q ? `?${q}` : ''}`,
  );
}

export function getInboxConversation(id: string) {
  return api<InboxConversationDetail>(`/api/v1/inbox/conversations/${id}`);
}

export type InboxConnections = {
  connectedPages: number;
  pages: { id: string; name: string; network: string; brandId: string | null }[];
  lastSyncAt: string | null;
  realtimeWebhooks: boolean;
};

export function getInboxConnections(brandId?: string | null) {
  const q = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
  return api<InboxConnections>(`/api/v1/inbox/connections${q}`);
}

export function syncInbox(brandId?: string | null) {
  return api<{ queued: boolean }>('/api/v1/inbox/sync', {
    method: 'POST',
    body: JSON.stringify({ brandId: brandId ?? null }),
  });
}

export function replyInboxConversation(
  id: string,
  content: string,
  replyToMessageId?: string | null,
) {
  return api<{
    id: string;
    externalDelivered: boolean;
    externalMessageId: string | null;
    note: string | null;
  }>(`/api/v1/inbox/conversations/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      ...(replyToMessageId ? { replyToMessageId } : {}),
    }),
  });
}

export function hideInboxMessage(messageId: string) {
  return api<{ ok: boolean }>(`/api/v1/inbox/messages/${messageId}/hide`, { method: 'POST' });
}

export function deleteInboxMessage(messageId: string) {
  return api<{ ok: boolean }>(`/api/v1/inbox/messages/${messageId}/delete`, { method: 'POST' });
}

export function assignInboxConversation(id: string, assignedToUserId: string | null) {
  return api(`/api/v1/inbox/conversations/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assignedToUserId }),
  });
}

export function setInboxTags(id: string, tags: string[]) {
  return api(`/api/v1/inbox/conversations/${id}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  });
}

export function setInboxPriority(id: string, priority: boolean) {
  return api(`/api/v1/inbox/conversations/${id}/priority`, {
    method: 'POST',
    body: JSON.stringify({ priority }),
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

export function bulkUpdateInbox(body: {
  ids: string[];
  status?: string;
  assignedToUserId?: string | null;
  priority?: boolean;
}) {
  return api<{ updated: number }>('/api/v1/inbox/conversations/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
