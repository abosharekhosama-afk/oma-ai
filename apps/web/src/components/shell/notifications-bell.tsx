'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';

type NotificationItem = {
  id: string;
  type: string;
  deepLinkPath: string;
  createdAt: string;
  readAt?: string | null;
};

export function NotificationsBell() {
  const t = useT();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: NotificationItem[] }>('/api/v1/notifications')
      .then((res) => setItems(res.items))
      .catch((err) => {
        // No active tenant / capability → hide quietly.
        if (err?.status === 409 || err?.status === 403) setItems([]);
        else setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const unread = (items ?? []).filter((n) => !n.readAt).length;

  return (
    <div className="oma-notifications">
      <button
        type="button"
        className="oma-btn oma-btn-secondary"
        aria-expanded={open}
        aria-controls="notifications-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {t('shell.notifications')}
        {unread > 0 ? <span className="oma-badge">{unread}</span> : null}
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
                <li key={n.id}>
                  {n.deepLinkPath ? (
                    <Link href={n.deepLinkPath}>{n.type}</Link>
                  ) : (
                    <span>{n.type}</span>
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
