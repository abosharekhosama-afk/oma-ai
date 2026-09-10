'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { apiMutate, getApiError } from '../../lib/brand-api';
import { useT } from '../../lib/use-locale';
import { ShellIcon } from './shell-icons';

type NotificationItem = {
  id: string;
  type: string;
  deepLinkPath: string;
  createdAt: string;
  readAt?: string | null;
};

function notificationLabel(t: (key: string) => string, type: string): string {
  const key = `shell.notification.type.${type}`;
  const translated = t(key);
  return translated === key ? type : translated;
}

export function NotificationsBell() {
  const t = useT();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ items: NotificationItem[] }>('/api/v1/notifications')
      .then((res) => setItems(res.items))
      .catch((err) => {
        if (err?.status === 409 || err?.status === 403) setItems([]);
        else setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function markRead(id: string) {
    try {
      await apiMutate(`/api/v1/notifications/${id}/read`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setItems((prev) =>
        (prev ?? []).map((n) =>
          n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
        ),
      );
    } catch (err) {
      setError(getApiError(err).message);
    }
  }

  const unread = (items ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="oma-notifications" ref={rootRef}>
      <button
        type="button"
        className="oma-icon-btn"
        aria-label={t('shell.notifications')}
        aria-expanded={open}
        aria-controls="notifications-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <ShellIcon name="bell" />
        {unread > 0 ? <span className="oma-badge oma-badge--primary">{unread}</span> : null}
      </button>
      {open ? (
        <div id="notifications-panel" className="oma-notifications-panel" role="region">
          {error ? (
            <p role="alert">{error}</p>
          ) : items === null ? (
            <p role="status">{t('common.loading')}</p>
          ) : items.length === 0 ? (
            <p className="oma-muted">{t('shell.notificationsEmpty')}</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className={n.readAt ? undefined : 'oma-notification-unread'}>
                  {n.deepLinkPath ? (
                    <Link
                      href={n.deepLinkPath}
                      data-testid={`notification-link-${n.id}`}
                      onClick={() => {
                        if (!n.readAt) void markRead(n.id);
                      }}
                    >
                      {notificationLabel(t, n.type)}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="oma-linkish"
                      onClick={() => {
                        if (!n.readAt) void markRead(n.id);
                      }}
                    >
                      {notificationLabel(t, n.type)}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
