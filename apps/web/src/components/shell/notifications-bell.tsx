'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShellIcon } from './shell-icons';
import { CheckSquareIcon, ClockIcon, EnvelopeIcon, ImageIcon, UsersIcon } from '../ui/plx-icons';
import { Drawer } from '../ui/drawer';
import { useLocale, useT } from '../../lib/use-locale';
import { listNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from '../../lib/notifications-api';
import { getApiError } from '../../lib/brand-api';

export type NotificationCategory = 'approvals' | 'publishing' | 'feedback' | 'tasks' | 'workspace';
export const notificationCategories: NotificationCategory[] = ['approvals', 'publishing', 'feedback', 'tasks', 'workspace'];

const categoryTypes: Record<NotificationCategory, string[]> = {
  approvals: ['content.approval_requested', 'content.approved', 'content.changes_requested', 'content.rejected', 'deliverable.review', 'deliverable.approved', 'deliverable.changes_requested', 'deliverable.rejected', 'strategy.submitted', 'strategy.approved'],
  publishing: ['content.scheduled', 'content.published', 'content.publish.succeeded', 'content.publish.failed'],
  feedback: ['content.comment', 'task.comment', 'deliverable.comment'],
  tasks: ['request.assigned', 'request.converted', 'task.assigned'],
  workspace: ['membership.invited'],
};

export function notificationCategory(type: string): NotificationCategory {
  return notificationCategories.find((category) => categoryTypes[category].includes(type)) ?? 'workspace';
}

export function notificationCategoryLabel(category: NotificationCategory, isAr: boolean): string {
  const labels: Record<NotificationCategory, [string, string]> = {
    approvals: ['Approvals', 'الموافقات'], publishing: ['Publishing', 'النشر'], feedback: ['Feedback', 'التعليقات'], tasks: ['Tasks', 'المهام'], workspace: ['Workspace', 'مساحة العمل'],
  };
  return isAr ? labels[category][1] : labels[category][0];
}

export function NotificationTypeIcon({ category, size = 18 }: { category: NotificationCategory; size?: number }) {
  const props = { width: size, height: size };
  if (category === 'approvals') return <CheckSquareIcon {...props} />;
  if (category === 'publishing') return <ClockIcon {...props} />;
  if (category === 'feedback') return <EnvelopeIcon {...props} />;
  if (category === 'tasks') return <ImageIcon {...props} />;
  return <UsersIcon {...props} />;
}

export function formatWhen(iso: string, locale: string): string {
  try {
    const d = new Date(iso); const diff = Date.now() - d.getTime(); const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diff < 60_000) return rtf.format(0, 'second');
    if (diff < 3600_000) return rtf.format(-Math.floor(diff / 60_000), 'minute');
    if (diff < 86400_000) return rtf.format(-Math.floor(diff / 3600_000), 'hour');
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

export function notificationLabel(t: (k: string) => string, n: AppNotification): string {
  const key = `shell.notification.${n.type}`; const translated = t(key);
  return translated && translated !== key ? translated : n.title || t('shell.notification.generic');
}
export function notificationBodyText(t: (k: string) => string, n: AppNotification): string | null {
  const key = `shell.notificationBody.${n.type}`; const translated = t(key);
  return translated && translated !== key ? translated : n.body || null;
}

export function NotificationRow({ n, t, locale, markRead }: { n: AppNotification; t: (k: string) => string; locale: string; markRead: (id: string) => void }) {
  const category = notificationCategory(n.type);
  const body = notificationBodyText(t, n);
  const content = <><span className="oma-notification-card__title">{notificationLabel(t, n)}</span>{body ? <span className="oma-notification-card__body">{body}</span> : null}<span className="oma-notification-card__preview"><span className="oma-notification-card__preview-thumb"><ImageIcon width={14} height={14} /></span>{n.objectType ? `${n.objectType}${n.objectId ? ` · ${n.objectId.slice(0, 8)}` : ''}` : (body || 'OMA activity')}</span></>;
  return <li className={`oma-notification-card${n.readAt ? '' : ' is-unread'}`} data-read={n.readAt ? 'true' : 'false'}>
    <span className={`oma-notification-card__icon is-${category}`}><NotificationTypeIcon category={category} /></span>
    <div className="oma-notification-card__main">{n.deepLinkPath ? <Link href={n.deepLinkPath} onClick={() => !n.readAt && markRead(n.id)}>{content}</Link> : <button type="button" onClick={() => !n.readAt && markRead(n.id)}>{content}</button>}<span className="oma-notification-card__time">{formatWhen(n.createdAt, locale)}{!n.readAt ? <i aria-label="unread" /> : null}</span></div>
  </li>;
}

export function NotificationsBell() {
  const t = useT(); const locale = useLocale(); const isAr = locale === 'ar';
  const [open, setOpen] = useState(false); const [items, setItems] = useState<AppNotification[] | null>(null); const [error, setError] = useState<string | null>(null); const [markingAll, setMarkingAll] = useState(false); const [category, setCategory] = useState<NotificationCategory>('approvals');
  const load = useCallback(async () => { try { const res = await listNotifications(); setItems(res.items); setError(null); } catch (err) { setError(getApiError(err).message); setItems([]); } }, []);
  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => { void load(); const id = window.setInterval(() => { if (!open) void load(); }, 60_000); return () => window.clearInterval(id); }, [load, open]);
  async function markRead(id: string) { try { await markNotificationRead(id); setItems((prev) => prev ? prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n) : prev); } catch (err) { setError(getApiError(err).message); } }
  async function markAll() { setMarkingAll(true); try { await markAllNotificationsRead(); setItems((prev) => prev ? prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) : prev); } catch (err) { setError(getApiError(err).message); } finally { setMarkingAll(false); } }
  const unread = (items ?? []).filter((n) => !n.readAt).length;
  const counts = useMemo(() => Object.fromEntries(notificationCategories.map((c) => [c, (items ?? []).filter((n) => notificationCategory(n.type) === c && !n.readAt).length])) as Record<NotificationCategory, number>, [items]);
  const shown = (items ?? []).filter((n) => notificationCategory(n.type) === category);
  const panel = <div id="notifications-panel" className="oma-notifications-panel oma-notifications-panel--planable oma-notifications-panel--categorized oma-notifications-panel--drawer" role="region" data-testid="shell-notifications-panel">
    <header className="oma-notifications-panel__head"><strong>{isAr ? 'آخر النشاطات' : 'Recent activity'}</strong>{unread > 0 ? <button type="button" className="oma-notifications-panel__mark-all" disabled={markingAll} onClick={() => void markAll()}>{t('shell.markAllRead')}</button> : null}</header>
    <div className="oma-notifications-panel__tabs" role="tablist">{notificationCategories.map((c) => <button key={c} type="button" role="tab" aria-selected={category === c} className={category === c ? 'is-active' : ''} onClick={() => setCategory(c)}><NotificationTypeIcon category={c} size={16} /><span>{notificationCategoryLabel(c, isAr)}</span>{counts[c] > 0 ? <b>{counts[c]}</b> : null}</button>)}</div>
    <div className="oma-notifications-panel__unread-row"><span>{isAr ? 'غير المقروءة' : 'Unread'}</span><span className="oma-notifications-panel__unread-count">{counts[category] ?? 0}</span></div>
    {error ? <p role="alert" className="oma-notifications-panel__error">{error}</p> : items === null ? <p role="status" className="oma-muted">{t('common.loading')}</p> : shown.length === 0 ? <div className="oma-notifications-panel__empty"><ShellIcon name="bell" size={24} /><p>{t('shell.notificationsEmpty')}</p></div> : <ul className="oma-notifications-panel__list">{shown.map((n) => <NotificationRow key={n.id} n={n} t={t} locale={locale} markRead={(id) => void markRead(id)} />)}</ul>}
    <footer className="oma-notifications-panel__foot"><Link href="/app/notifications" onClick={() => setOpen(false)}>{t('shell.notificationsViewAll')}</Link></footer>
  </div>;
  return <><span className="oma-notifications"><button type="button" className="oma-icon-btn oma-rail-utility-trigger" aria-label={t('shell.notifications')} aria-expanded={open} aria-controls="notifications-panel" data-testid="shell-notifications-trigger" onClick={() => setOpen(true)}><ShellIcon name="bell" />{unread > 0 ? <span className="oma-badge oma-badge--primary" data-testid="shell-notifications-unread">{unread > 99 ? '99+' : unread}</span> : null}</button></span><Drawer open={open} onClose={() => setOpen(false)} label={t('shell.notifications')} wide className="oma-notifications-drawer" id="notifications-drawer">{panel}</Drawer></>;
}
