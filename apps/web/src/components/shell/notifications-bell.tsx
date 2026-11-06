'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ShellIcon } from './shell-icons';
import { CloseOutlined, MoreOutlined } from '../ui/lucide-icons';
import { CheckSquareIcon, ClockIcon, EnvelopeIcon, ImageIcon, UsersIcon } from '../ui/plx-icons';
import { FacebookGlyph, InstagramGlyph, TikTokGlyph, XGlyph } from '../landing/platform-icons';
import { Drawer as AntDrawer } from '@oma/ui/controls';
import { MediaSurface } from '../content/media-surface';
import { useLocale, useT } from '../../lib/use-locale';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../../lib/notifications-api';
import { getApiError } from '../../lib/brand-api';

export type NotificationCategory = 'approvals' | 'publishing' | 'feedback' | 'tasks' | 'workspace';
export const notificationCategories: NotificationCategory[] = [
  'approvals',
  'publishing',
  'feedback',
  'tasks',
  'workspace',
];

/** Planable-style inbox tabs (maps to underlying notification categories). */
export type NotificationTab = 'approvals' | 'feedback' | 'social_inbox' | 'listening';

export const notificationTabs: NotificationTab[] = [
  'approvals',
  'feedback',
  'social_inbox',
  'listening',
];

const categoryTypes: Record<NotificationCategory, string[]> = {
  approvals: [
    'content.approval_requested',
    'content.approved',
    'content.changes_requested',
    'content.rejected',
    'deliverable.review',
    'deliverable.approved',
    'deliverable.changes_requested',
    'deliverable.rejected',
    'strategy.submitted',
    'strategy.approved',
  ],
  publishing: [
    'content.scheduled',
    'content.published',
    'content.publish.succeeded',
    'content.publish.failed',
  ],
  feedback: ['content.comment', 'task.comment', 'deliverable.comment'],
  tasks: ['request.assigned', 'request.converted', 'task.assigned'],
  workspace: ['membership.invited'],
};

export function notificationTabCategories(tab: NotificationTab): NotificationCategory[] {
  if (tab === 'approvals') return ['approvals'];
  if (tab === 'feedback') return ['feedback'];
  if (tab === 'social_inbox') return ['publishing'];
  return ['tasks', 'workspace'];
}

export function notificationCategory(type: string): NotificationCategory {
  return (
    notificationCategories.find((category) => categoryTypes[category].includes(type)) ?? 'workspace'
  );
}

export function notificationCategoryLabel(category: NotificationCategory, isAr: boolean): string {
  const labels: Record<NotificationCategory, [string, string]> = {
    approvals: ['Approvals', 'الموافقات'],
    publishing: ['Publishing', 'النشر'],
    feedback: ['Feedback', 'التعليقات'],
    tasks: ['Tasks', 'المهام'],
    workspace: ['Workspace', 'مساحة العمل'],
  };
  return isAr ? labels[category][1] : labels[category][0];
}

export function notificationTabLabel(tab: NotificationTab, isAr: boolean): string {
  const labels: Record<NotificationTab, [string, string]> = {
    approvals: ['Approvals', 'الموافقات'],
    feedback: ['Feedback', 'التعليقات'],
    social_inbox: ['Social inbox', 'صندوق التواصل'],
    listening: ['Listening', 'الاستماع'],
  };
  return isAr ? labels[tab][1] : labels[tab][0];
}

export function NotificationTypeIcon({
  category,
  size = 18,
}: {
  category: NotificationCategory;
  size?: number;
}) {
  const props = { width: size, height: size };
  if (category === 'approvals') return <CheckSquareIcon {...props} />;
  if (category === 'publishing') return <ClockIcon {...props} />;
  if (category === 'feedback') return <EnvelopeIcon {...props} />;
  if (category === 'tasks') return <ImageIcon {...props} />;
  return <UsersIcon {...props} />;
}

export function formatWhen(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diff < 60_000) return rtf.format(0, 'second');
    if (diff < 3600_000) return rtf.format(-Math.floor(diff / 60_000), 'minute');
    if (diff < 86400_000) return rtf.format(-Math.floor(diff / 3600_000), 'hour');
    if (diff < 86400_000 * 30) return rtf.format(-Math.floor(diff / 86400_000), 'day');
    if (diff < 86400_000 * 365) return rtf.format(-Math.floor(diff / (86400_000 * 30)), 'month');
    return rtf.format(-Math.floor(diff / (86400_000 * 365)), 'year');
  } catch {
    return '';
  }
}

export function notificationLabel(t: (k: string) => string, n: AppNotification): string {
  const key = `shell.notification.${n.type}`;
  const translated = t(key);
  return translated && translated !== key ? translated : n.title || t('shell.notification.generic');
}

export function notificationBodyText(t: (k: string) => string, n: AppNotification): string | null {
  const key = `shell.notificationBody.${n.type}`;
  const translated = t(key);
  return translated && translated !== key ? translated : n.body || null;
}

function actorInitials(n: AppNotification, t: (k: string) => string): string {
  const label = notificationLabel(t, n);
  const word = label.match(/[\p{L}\p{N}]+/u)?.[0] ?? label.trim().slice(0, 1);
  return (word?.slice(0, 1) ?? '?').toUpperCase();
}

function previewBrandTag(channel: string | undefined): string | null {
  if (!channel?.trim()) return null;
  const parts = channel
    .split(/[,|/·]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return channel.trim();
  if (/facebook|instagram|tiktok|twitter|linkedin|youtube/i.test(last) && parts.length > 1) {
    return parts[parts.length - 2] ?? last;
  }
  return last;
}

function PreviewPlatformIcons({ channel }: { channel?: string | null }) {
  if (!channel?.trim()) return null;
  const hay = channel.toLowerCase();
  const icons: { key: string; node: ReactNode }[] = [];
  if (hay.includes('facebook') || hay.includes('fb')) {
    icons.push({ key: 'fb', node: <FacebookGlyph /> });
  }
  if (hay.includes('instagram') || hay.includes('ig')) {
    icons.push({ key: 'ig', node: <InstagramGlyph /> });
  }
  if (hay.includes('tiktok')) {
    icons.push({ key: 'tt', node: <TikTokGlyph /> });
  }
  if (hay.includes('twitter') || hay.includes(' x ') || hay.endsWith(' x')) {
    icons.push({ key: 'x', node: <XGlyph /> });
  }
  if (!icons.length) return null;
  return (
    <span className="oma-notification-card__platforms" aria-hidden>
      {icons.slice(0, 4).map((item) => (
        <span key={item.key} className="oma-notification-card__platform">
          {item.node}
        </span>
      ))}
    </span>
  );
}

export function NotificationRow({
  n,
  t,
  locale,
  markRead,
}: {
  n: AppNotification;
  t: (k: string) => string;
  locale: string;
  markRead: (id: string) => void;
}) {
  const category = notificationCategory(n.type);
  const body = notificationBodyText(t, n);
  const label = notificationLabel(t, n);
  const preview = n.contentPreview;
  const previewTitle = preview
    ? locale.toLowerCase().startsWith('ar')
      ? preview.titleAr
      : preview.titleEn
    : null;
  const previewCaption = preview
    ? locale.toLowerCase().startsWith('ar')
      ? preview.captionAr
      : preview.captionEn
    : null;
  const previewSnippet = previewCaption?.trim() || previewTitle?.trim() || null;
  const brandTag = previewBrandTag(preview?.channel ?? undefined);
  const showPreview = Boolean(
    preview?.imageUrl?.trim() || previewSnippet || preview?.channel?.trim(),
  );
  const content = (
    <>
      <div className="oma-notification-card__headline">
        <p className="oma-notification-card__message">
          <span className="oma-notification-card__message-text">{label}</span>
          {body ? <span className="oma-notification-card__message-body"> {body}</span> : null}
        </p>
        <span className="oma-notification-card__time">
          {formatWhen(n.createdAt, locale)}
          {!n.readAt ? <i aria-label="unread" /> : null}
        </span>
      </div>
      {showPreview ? (
        <span className="oma-notification-card__preview">
          {preview?.imageUrl ? (
            <MediaSurface
              className="oma-notification-card__preview-image"
              src={preview.imageUrl}
              mime={preview.mime}
              contentType={preview.contentType ?? undefined}
              alt=""
              preload="metadata"
            />
          ) : (
            <span className="oma-notification-card__preview-thumb" aria-hidden>
              <ImageIcon width={14} height={14} />
            </span>
          )}
          <span className="oma-notification-card__preview-copy">
            {previewSnippet ? <span>{previewSnippet}</span> : null}
          </span>
          <PreviewPlatformIcons channel={preview?.channel} />
          {brandTag ? <span className="oma-notification-card__brand">{brandTag}</span> : null}
        </span>
      ) : null}
    </>
  );
  return (
    <li
      className={`oma-notification-card${n.readAt ? '' : ' is-unread'}`}
      data-read={n.readAt ? 'true' : 'false'}
    >
      <span className="oma-notification-card__avatar-wrap">
        <span className="oma-notification-card__avatar">{actorInitials(n, t)}</span>
        <span className={`oma-notification-card__avatar-badge is-${category}`} aria-hidden>
          <NotificationTypeIcon category={category} size={11} />
        </span>
      </span>
      <div className="oma-notification-card__main">
        {n.deepLinkPath ? (
          <Link href={n.deepLinkPath} onClick={() => !n.readAt && markRead(n.id)}>
            {content}
          </Link>
        ) : (
          <button type="button" onClick={() => !n.readAt && markRead(n.id)}>
            {content}
          </button>
        )}
      </div>
    </li>
  );
}

export function NotificationsBell() {
  const t = useT();
  const locale = useLocale();
  const isAr = locale === 'ar';
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [category, setCategory] = useState<NotificationTab>('approvals');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [slackHidden, setSlackHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
      setMenuOpen(false);
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setMarkingAll(false);
    }
  }
  const unread = (items ?? []).filter((n) => !n.readAt).length;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        notificationTabs.map((tab) => [
          tab,
          (items ?? []).filter(
            (n) =>
              notificationTabCategories(tab).includes(notificationCategory(n.type)) && !n.readAt,
          ).length,
        ]),
      ) as Record<NotificationTab, number>,
    [items],
  );
  const tabTotal = (items ?? []).filter((n) =>
    notificationTabCategories(category).includes(notificationCategory(n.type)),
  ).length;
  const shown = (items ?? []).filter(
    (n) =>
      notificationTabCategories(category).includes(notificationCategory(n.type)) &&
      (!unreadOnly || !n.readAt),
  );
  const panel = (
    <div
      id="notifications-panel"
      className="oma-notifications-panel oma-notifications-panel--planable oma-notifications-panel--categorized oma-notifications-panel--drawer"
      role="region"
      data-testid="shell-notifications-panel"
    >
      <header className="oma-notifications-panel__head">
        <strong>{t('shell.notifications')}</strong>
        <span className="oma-notifications-panel__actions">
          <button
            type="button"
            className="oma-notifications-panel__close"
            aria-label={t('common.close')}
            onClick={() => setOpen(false)}
          >
            <CloseOutlined />
          </button>
        </span>
      </header>

      {!slackHidden ? (
        <div className="oma-notifications-panel__slack" data-testid="shell-notifications-slack">
          <div className="oma-notifications-panel__slack-copy">
            <span className="oma-notifications-panel__slack-mark" aria-hidden>
              #
            </span>
            <p>{isAr ? 'استقبل الإشعارات في Slack.' : 'Bring notifications to Slack.'}</p>
          </div>
          <div className="oma-notifications-panel__slack-actions">
            <button type="button" onClick={() => setSlackHidden(true)}>
              {isAr ? 'إخفاء' : 'Hide'}
            </button>
            <button
              type="button"
              className="is-primary"
              disabled
              title={t('demo.settings.notificationsHonesty')}
            >
              {isAr ? 'ربط' : 'Connect'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="oma-notifications-panel__tabs" role="tablist">
        {notificationTabs.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={category === c ? 'is-active' : ''}
            onClick={() => setCategory(c)}
          >
            <span>{notificationTabLabel(c, isAr)}</span>
            {counts[c] > 0 ? <b>{counts[c]}</b> : null}
          </button>
        ))}
      </div>

      <div className="oma-notifications-panel__unread-row">
        <label className="oma-notifications-panel__unreads">
          <span>{isAr ? 'غير المقروءة' : 'Unreads'}</span>
          <input
            type="checkbox"
            role="switch"
            aria-checked={unreadOnly}
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            data-testid="shell-notifications-unreads-toggle"
          />
        </label>
        <div className="oma-notifications-panel__menu-wrap">
          <button
            type="button"
            className="oma-notifications-panel__menu"
            aria-expanded={menuOpen}
            aria-label={isAr ? 'المزيد' : 'More'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreOutlined />
          </button>
          {menuOpen ? (
            <div className="oma-notifications-panel__menu-pop">
              <button
                type="button"
                disabled={markingAll || unread === 0}
                onClick={() => void markAll()}
              >
                {t('shell.markAllRead')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="oma-notifications-panel__error">
          {error}
        </p>
      ) : items === null ? (
        <p role="status" className="oma-muted oma-notifications-panel__loading">
          {t('common.loading')}
        </p>
      ) : shown.length === 0 ? (
        <div className="oma-notifications-panel__empty">
          <ShellIcon name="bell" size={24} />
          <p>{t('shell.notificationsEmpty')}</p>
        </div>
      ) : (
        <ul className="oma-notifications-panel__list">
          {shown.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              t={t}
              locale={locale}
              markRead={(id) => void markRead(id)}
            />
          ))}
        </ul>
      )}
      <footer className="oma-notifications-panel__foot">
        <Link
          href="/app/notifications"
          data-testid="shell-notifications-view-all"
          onClick={() => setOpen(false)}
        >
          {t('shell.notificationsViewAll')}
        </Link>
        {!unreadOnly && tabTotal > shown.length ? (
          <span className="oma-notifications-panel__foot-meta">
            {isAr ? `${shown.length} من ${tabTotal}` : `${shown.length} of ${tabTotal} in this tab`}
          </span>
        ) : null}
      </footer>
    </div>
  );
  return (
    <>
      <span className="oma-notifications">
        <button
          type="button"
          className="oma-icon-btn oma-rail-utility-trigger"
          aria-label={t('shell.notifications')}
          aria-expanded={open}
          aria-controls="notifications-panel"
          data-testid="shell-notifications-trigger"
          onClick={() => setOpen(true)}
        >
          <ShellIcon name="bell" />
          {unread > 0 ? (
            <span className="oma-badge oma-badge--primary" data-testid="shell-notifications-unread">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </span>
      <AntDrawer
        open={open}
        onClose={() => setOpen(false)}
        placement={isAr ? 'left' : 'right'}
        size={400}
        mask={true}
        closable={false}
        title={null}
        rootClassName="oma-notifications-drawer"
        styles={{ body: { padding: 0 } }}
        aria-label={t('shell.notifications')}
      >
        {panel}
      </AntDrawer>
    </>
  );
}
