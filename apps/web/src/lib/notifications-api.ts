import { api } from './api';

export type AppNotification = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  deepLinkPath: string;
  objectType?: string | null;
  objectId?: string | null;
  createdAt: string;
  readAt: string | null;
};

export async function listNotifications(): Promise<{
  items: AppNotification[];
  unread_count: number;
}> {
  const res = await api<{ items: AppNotification[]; unread_count?: number }>(
    '/api/v1/notifications',
  );
  return {
    items: res.items ?? [],
    unread_count: res.unread_count ?? (res.items ?? []).filter((n) => !n.readAt).length,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await api(`/api/v1/notifications/${id}/read`, { method: 'POST', body: '{}' });
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await api<{ data: { updated: number } }>('/api/v1/notifications/read-all', {
    method: 'POST',
    body: '{}',
  });
  return res.data?.updated ?? 0;
}
