'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ShellPopover } from './shell-popover';
import { Button } from '@oma/ui/controls';
import { ShellIcon } from './shell-icons';
import { useLocale, useT } from '../../lib/use-locale';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../lib/notifications-api';
import { getApiError } from '../../lib/brand-api';

/** Relative time in the active locale (Arabic digits/words in ar, LTR/RTL safe). */
export function formatWhen(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diff < 60_000) return rtf.format(0, 'second');
    if (diff < 3600_000) return rtf.format(-Math.floor(diff / 60_000), 'minute');
    if (diff < 86400_000) return rtf.format(-Math.floor(diff / 3600_000), 'hour');
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

/** Localized title (en/ar) by type; falls back to the API's English copy. */
export function notificationLabel(t: (k: string) => string, n: AppNotification): string {
  const key = `shell.notification.${n.type}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return t('shell.notification.generic');
}

export function notificationBodyText(t: (k: string) => string, n: AppNotification): string | null {
  const key = `shell.notificationBody.${n.type}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return null;
}

export function NotificationsBell() {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listNotifications();
      setItems(res.items);
      setError(null);
    } catch (err) {
      setError(getApiError(err).message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  // Light poll for badge while closed
  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (!open) void load();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [load, open]);

  async function markRead(id: string) {
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev
          ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
          : prev,
      );
    } catch (err) {
      setError(getApiError(err).message);
    }
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : prev,
      );
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setMarkingAll(false);
    }
  }

  const unread = (items ?? []).filter((n) => !n.readAt).length;

  const panel = (
    <div
      id="notifications-panel"
      className="oma-notifications-panel oma-notifications-panel--planable"
      role="region"
      data-testid="shell-notifications-panel"
    >
      <header className="oma-notifications-panel__head">
        <strong>{t('shell.notifications')}</strong>
        {unread > 0 ? (
          <button
            type="button"
            className="oma-notifications-panel__mark-all"
            disabled={markingAll}
            onClick={() => void markAll()}
            data-testid="shell-notifications-mark-all"
          >
            {t('shell.markAllRead')}
          </button>
        ) : null}
      </header>
      {error ? (
        <p role="alert" className="oma-notifications-panel__error">
          {error}
        </p>
      ) : items === null ? (
        <p role="status" className="oma-muted">
          {t('common.loading')}
        </p>
      ) : items.length === 0 ? (
        <div className="oma-notifications-panel__empty">
          <p className="oma-muted">{t('shell.notificationsEmpty')}</p>
        </div>
      ) : (
        <ul className="oma-notifications-panel__list">
          {items.map((n) => (
            <li
              key={n.id}
              className={n.readAt ? undefined : 'oma-notification-unread'}
              data-testid={`notification-item-${n.id}`}
              data-read={n.readAt ? 'true' : 'false'}
            >
              {n.deepLinkPath ? (
                <Link
                  href={n.deepLinkPath}
                  data-testid={`notification-link-${n.id}`}
                  onClick={() => {
                    if (!n.readAt) void markRead(n.id);
                  }}
                >
                  <span className="oma-notification-title">{notificationLabel(t, n)}</span>
                  {notificationBodyText(t, n) ? (
                    <span className="oma-notification-body">{notificationBodyText(t, n)}</span>
                  ) : null}
                </Link>
              ) : (
                <Button
                  type="default"
                  data-testid={`notification-mark-${n.id}`}
                  onClick={() => {
                    if (!n.readAt) void markRead(n.id);
                  }}
                  className="oma-linkish"
                >
                  {notificationLabel(t, n)}
                </Button>
              )}
              <span className="oma-notification-meta">
                {t('shell.notificationsInApp')} · {formatWhen(n.createdAt, locale)}
                {!n.readAt && n.deepLinkPath ? (
                  <span className="oma-notification-actions">
                    <button
                      type="button"
                      className="oma-notification-mark"
                      data-testid={`notification-read-${n.id}`}
                      onClick={() => void markRead(n.id)}
                    >
                      {t('shell.markRead')}
                    </button>
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <footer className="oma-notifications-panel__foot">
        <Link
          href="/app/notifications"
          className="oma-notifications-panel__view-all"
          data-testid="shell-notifications-view-all"
          onClick={() => setOpen(false)}
        >
          {t('shell.notificationsViewAll')}
        </Link>
      </footer>
    </div>
  );

  return (
    <ShellPopover open={open} onOpenChange={setOpen} content={panel} className="oma-notifications-pop">
      <span className="oma-notifications">
      <button
        type="button"
        className="oma-icon-btn"
        aria-label={t('shell.notifications')}
        aria-expanded={open}
        aria-controls="notifications-panel"
        data-testid="shell-notifications-trigger"
      >
        <ShellIcon name="bell" />
        {unread > 0 ? (
          <span className="oma-badge oma-badge--primary" data-testid="shell-notifications-unread">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      </span>
    </ShellPopover>
  );
}
