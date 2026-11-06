'use client';

import Link from 'next/link';
import type { ActivityItem } from '../../lib/activity-api';
import { MediaSurface } from '../content/media-surface';

type T = (key: string) => string;

/** "did action" phrase for an audit action; i18n key `activity.verb.<action>` with a safe fallback. */
export function activityVerb(t: T, item: Pick<ActivityItem, 'action' | 'title'>): string {
  const key = `activity.verb.${item.action.replace(/\./g, '_')}`;
  const v = t(key);
  if (v && v !== key) return v;
  return item.title.toLowerCase();
}

/** Short relative time ("5m ago", "منذ ٥ دقائق"), falling back to a date for older items. */
export function relativeTime(iso: string, locale: string, now = Date.now()): string {
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  const lang = locale.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const diff = Math.round((at - now) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), 'day');
  return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }).format(new Date(at));
}

function initials(name: string): string {
  const parts = name
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

const CATEGORY_LABEL: Record<string, string> = {
  members: 'Members',
  approvals: 'Approvals',
  content: 'Content',
  settings: 'Settings',
};

export function ActivityFeedItem({
  item,
  locale,
  t,
}: {
  item: ActivityItem;
  locale: string;
  t: T;
}) {
  const isAr = locale.toLowerCase().startsWith('ar');
  const target = item.target ?? null;
  const targetName = target ? (isAr ? target.name.ar || target.name.en : target.name.en) : null;
  const isContentActivity = target?.type === 'content';
  const isCommentAction = item.action.includes('comment');
  const snippet =
    isCommentAction && target?.snippet_kind !== 'comment'
      ? ''
      : target?.snippet
        ? isAr
          ? target.snippet.ar || target.snippet.en
          : target.snippet.en
        : '';
  const fullTime = new Date(item.at).toLocaleString(isAr ? 'ar' : 'en');
  const catLabel =
    t(`activity.filter.${item.category}`) || CATEGORY_LABEL[item.category] || item.category;

  return (
    <li
      className="oma-plx-listening-card oma-plx-activity-card"
      data-testid="activity-item"
      data-category={item.category}
      data-visual={isContentActivity && target?.thumbnail_url ? 'content' : 'actor'}
    >
      <div className="oma-plx-listening-card__top oma-plx-activity-card__top">
        <div className="oma-plx-listening-card__author">
          {isContentActivity && target?.thumbnail_url ? (
            <MediaSurface
              className="oma-plx-activity-card__thumb"
              src={target.thumbnail_url}
              alt={targetName || ''}
            />
          ) : item.actor_avatar_url ? (
            <img
              className="oma-plx-listening-card__avatar oma-plx-activity-card__avatar-img"
              src={item.actor_avatar_url}
              alt={item.actor_name}
              loading="lazy"
            />
          ) : (
            <span
              className="oma-plx-listening-card__avatar oma-plx-activity-card__avatar"
              aria-hidden
            >
              {initials(item.actor_name || '?')}
            </span>
          )}
          <div className="oma-plx-listening-card__author-text">
            <div className="oma-plx-listening-card__name-row">
              <strong>{item.actor_name}</strong>
              <time className="oma-plx-activity-card__time" dateTime={item.at} title={fullTime}>
                {relativeTime(item.at, locale)}
              </time>
            </div>
            <span className="oma-plx-activity-card__verb">{activityVerb(t, item)}</span>
          </div>
        </div>
        <span className="oma-plx-activity-card__pill">{catLabel}</span>
      </div>

      <div className="oma-plx-listening-card__body oma-plx-activity-card__body">
        <p className="oma-plx-activity-card__line">
          {target && targetName ? (
            <Link
              href={target.href}
              className="oma-plx-activity-card__target"
              data-testid="activity-item-link"
            >
              {targetName}
            </Link>
          ) : (
            <span className="oma-plx-activity-card__muted">{item.title}</span>
          )}
        </p>
        {snippet ? (
          <blockquote className="oma-plx-activity-card__quote">{snippet}</blockquote>
        ) : null}
      </div>
    </li>
  );
}
