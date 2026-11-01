'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@oma/ui/controls';
import { useLocale, useT } from '../../../../lib/use-locale';
import { listNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '../../../../lib/notifications-api';
import { getApiError } from '../../../../lib/brand-api';
import { notificationCategories, notificationCategory, notificationCategoryLabel, NotificationRow } from '../../../../components/shell/notifications-bell';
import { ShellIcon } from '../../../../components/shell/shell-icons';

export default function NotificationsPage() {
  const t = useT(); const locale = useLocale(); const isAr = locale === 'ar';
  const [items, setItems] = useState<AppNotification[] | null>(null); const [error, setError] = useState<string | null>(null); const [category, setCategory] = useState((notificationCategories[0])); const [busy, setBusy] = useState(false); const [unreadOnly, setUnreadOnly] = useState(false);
  const load = useCallback(async () => { setError(null); try { setItems((await listNotifications()).items); } catch (err) { setError(getApiError(err).message); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function markRead(id: string) { try { await markNotificationRead(id); setItems((prev) => prev ? prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n) : prev); } catch (err) { setError(getApiError(err).message); } }
  async function markAll() { setBusy(true); try { await markAllNotificationsRead(); setItems((prev) => prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : prev); } catch (err) { setError(getApiError(err).message); } finally { setBusy(false); } }
  const unread = (items ?? []).filter((n) => !n.readAt).length;
  const counts = useMemo(() => Object.fromEntries(notificationCategories.map((c) => [c, (items ?? []).filter((n) => notificationCategory(n.type) === c && !n.readAt).length])) as Record<typeof notificationCategories[number], number>, [items]);
  const shown = (items ?? []).filter((n) => notificationCategory(n.type) === category && (!unreadOnly || !n.readAt));
  return <main className="oma-page oma-notifications-page oma-notifications-page--planable" data-testid="notifications-page">
    <header className="oma-notifications-page__head"><div><h1 className="oma-page-title">{t('shell.notifications')}</h1><p className="oma-muted">{isAr ? 'تابع الموافقات والنشر ونشاط فريقك من مكان واحد.' : 'Follow approvals, publishing and team activity in one place.'}</p></div><Button type="default" onClick={() => void markAll()} disabled={busy || unread === 0}>{t('shell.markAllRead')}</Button></header>
    <div className="oma-notifications-page__tabs" role="tablist">{notificationCategories.map((c) => <button key={c} type="button" role="tab" aria-selected={category === c} className={category === c ? 'is-active' : ''} onClick={() => setCategory(c)}><span>{notificationCategoryLabel(c, isAr)}</span>{counts[c] > 0 ? <b>{counts[c]}</b> : null}</button>)}</div>
    <div className="oma-notifications-page__toolbar"><label><input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> {isAr ? 'غير المقروءة فقط' : 'Unread only'}</label><span>{isAr ? `${counts[category]} غير مقروءة` : `${counts[category]} unread`}</span></div>
    {error ? <div role="alert" className="oma-notifications-page__state"><p>{error}</p><Button type="default" onClick={() => void load()}>{isAr ? 'إعادة المحاولة' : 'Retry'}</Button></div> : items === null ? <ul className="oma-notifications-page__list" aria-busy="true">{[0, 1, 2, 3].map((i) => <li key={i} className="oma-notifications-page__skeleton" />)}</ul> : shown.length === 0 ? <div className="oma-notifications-page__state"><ShellIcon name="bell" size={28} /><p>{isAr ? 'لا توجد إشعارات في هذا القسم.' : 'No notifications in this section.'}</p></div> : <ul className="oma-notifications-page__list" data-testid="notifications-page-list">{shown.map((n) => <NotificationRow key={n.id} n={n} t={t} locale={locale} markRead={(id) => void markRead(id)} />)}</ul>}
  </main>;
}
