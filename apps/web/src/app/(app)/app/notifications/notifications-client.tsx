'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale, useT } from '../../../../lib/use-locale';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../../../lib/notifications-api';
import { getApiError } from '../../../../lib/brand-api';
import {
  formatWhen,
  notificationBodyText,
  notificationLabel,
} from '../../../../components/shell/notifications-bell';
import { ShellIcon } from '../../../../components/shell/shell-icons';

type Filter = 'all' | 'unread';

/**
 * Notifications center. Entry point: sidebar bell → popover → "View all" → /app/notifications.
 */
export default function NotificationsPage() {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listNotifications();
      setItems(res.items);
    } catch (err) {
      setError(getApiError(err).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = (items ?? []).filter((n) => !n.readAt).length;
  const shown = useMemo(
    () => (items ?? []).filter((n) => (filter === 'unread' ? !n.readAt : true)),
    [items, filter],
  );

  async function markRead(id: string) {
    try {
      await markNotificationRead(id);
      setItems((prev) =>
        prev ? prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) : prev,
      );
    } catch (err) {
      setError(getApiError(err).message);
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : prev,
      );
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="oma-page oma-notifications-page" data-testid="notifications-page">
      <header className="oma-notifications-page__head">
        <div>
          <h1 className="oma-page-title">{t('shell.notifications')}</h1>
          <p className="oma-muted">{t('notificationsPage.subtitle')}</p>
        </div>
        <Button
          type="default"
          onClick={() => void markAll()}
          disabled={busy || unread === 0}
          data-testid="notifications-page-mark-all"
        >
          {t('shell.markAllRead')}
        </Button>
      </header>

      <div className="oma-ws-tabs" role="tablist" aria-label={t('notificationsPage.filter')}>
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`oma-ws-tab${filter === f ? ' is-active' : ''}`}
            onClick={() => setFilter(f)}
            data-testid={`notifications-filter-${f}`}
          >
            {t(`notificationsPage.filter.${f}`)}
            {f === 'unread' && unread > 0 ? (
              <span className="oma-badge oma-badge--primary">{unread.toLocaleString(locale)}</span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? (
        <div role="alert" className="oma-notifications-page__state" data-testid="notifications-page-error">
          <p>{error}</p>
          <Button type="default" onClick={() => void load()}>
            {t('notificationsPage.retry')}
          </Button>
        </div>
      ) : items === null ? (
        <ul className="oma-notifications-page__list" aria-busy="true" data-testid="notifications-page-loading">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="oma-notifications-page__skeleton" />
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <div className="oma-notifications-page__state" data-testid="notifications-page-empty">
          <ShellIcon name="bell" size={28} />
          <p>
            {filter === 'unread' ? t('notificationsPage.emptyUnread') : t('shell.notificationsEmpty')}
          </p>
        </div>
      ) : (
        <ul className="oma-notifications-page__list" data-testid="notifications-page-list">
          {shown.map((n) => {
            const body = notificationBodyText(t, n);
            return (
              <li
                key={n.id}
                className={`oma-notifications-page__item${n.readAt ? '' : ' is-unread'}`}
                data-read={n.readAt ? 'true' : 'false'}
                data-testid={`notifications-page-item-${n.id}`}
              >
                <span className="oma-notifications-page__dot" aria-hidden="true" />
                <div className="oma-notifications-page__text">
                  {n.deepLinkPath ? (
                    <Link
                      href={n.deepLinkPath}
                      className="oma-notifications-page__title"
                      onClick={() => {
                        if (!n.readAt) void markRead(n.id);
                      }}
                    >
                      {notificationLabel(t, n)}
                    </Link>
                  ) : (
                    <strong className="oma-notifications-page__title">{notificationLabel(t, n)}</strong>
                  )}
                  {body ? <span className="oma-muted">{body}</span> : null}
                  <time dateTime={n.createdAt} className="oma-notifications-page__time">
                    {formatWhen(n.createdAt, locale)}
                  </time>
                </div>
                <div className="oma-notifications-page__actions">
                  {n.deepLinkPath ? (
                    <Link href={n.deepLinkPath} className="oma-menu-item" onClick={() => !n.readAt && void markRead(n.id)}>
                      {t('notificationsPage.open')}
                    </Link>
                  ) : null}
                  {!n.readAt ? (
                    <Button type="text" onClick={() => void markRead(n.id)} data-testid={`notifications-page-read-${n.id}`}>
                      {t('shell.markRead')}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
