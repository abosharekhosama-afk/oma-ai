'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { NetworkIcon } from '../content/network-icon';
import { initials, isPlaceholderAsset } from '../content/post-preview-model';
import { Skeleton } from '../ui/empty-state';
import type { ActivityItem } from '../../lib/activity-api';
import { activityVerb } from '../activity/activity-feed-item';
import type {
  HomeAwaitingItem,
  HomeBrandSummary,
  HomeChecklistStep,
  HomeWeekItem,
} from '../../lib/home-api';
import {
  brandNetworks,
  bucketWeek,
  firstName,
  greetingFor,
  homeLinks,
  setupProgress,
  type HomeComment,
} from '../../lib/home-view-model';
import { MediaSurface } from '../content/media-surface';

type Copy = { en: string; ar: string };
type Tr = (key: string) => string;

export type HomeViewProps = {
  t: Tr;
  locale: 'en' | 'ar';
  now: Date;
  userName: string;
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
  brands: HomeBrandSummary[];
  awaiting: HomeAwaitingItem[];
  canApprove: boolean;
  onApprove: (item: HomeAwaitingItem) => void;
  comments: HomeComment[];
  week: HomeWeekItem[];
  /** Scheduling timezone + its 7 calendar days for the week strip (from the API). */
  weekTimezone?: string;
  weekDays?: string[];
  setup: { steps: HomeChecklistStep[]; visible: boolean; onDismiss: () => void };
  activity: ActivityItem[];
  activityError?: boolean;
  /** Bottom feedback bar (undo for quick approve). */
  feedback?: ReactNode;
};

const pick = (c: Copy | null | undefined, locale: 'en' | 'ar') =>
  c ? (locale === 'ar' ? c.ar || c.en : c.en) : '';
const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), s);

function relTime(iso: string, now: Date, locale: 'en' | 'ar') {
  const diff = (new Date(iso).getTime() - now.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const abs = Math.abs(diff);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

function BrandAvatar({
  name,
  logo,
  size = 40,
}: {
  name: string;
  logo: string | null;
  size?: number;
}) {
  return logo ? (
    <img className="oma-home-avatar" src={logo} alt="" width={size} height={size} />
  ) : (
    <span className="oma-home-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

function Thumb({ url, channel, size }: { url: string | null; channel: string; size: 'md' | 'sm' }) {
  return isPlaceholderAsset(url) ? (
    <span
      className={`oma-home-thumb oma-home-thumb--${size} oma-home-thumb--empty`}
      aria-hidden="true"
    >
      <NetworkIcon channel={channel} size={size === 'md' ? 20 : 14} mono />
    </span>
  ) : (
    <MediaSurface className={`oma-home-thumb oma-home-thumb--${size}`} src={url!} alt="" />
  );
}

function Card({
  title,
  action,
  children,
  id,
}: {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id: string;
}) {
  return (
    <section className="oma-home-card" aria-labelledby={id}>
      <header className="oma-home-card__head">
        <h2 id={id} className="oma-home-card__title">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Shimmer({ rows, height = '56px' }: { rows: number; height?: string }) {
  return (
    <div className="oma-home-shimmer">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}

export function HomeView(p: HomeViewProps) {
  const { t, locale, now } = p;
  const greeting = fill(t(`home.v2.greeting.${greetingFor(now.getHours())}`), {
    name: firstName(p.userName),
  });
  const days = bucketWeek(p.week, now, { days: p.weekDays, timezone: p.weekTimezone });
  const progress = setupProgress(p.setup.steps);
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...(p.weekTimezone ? { timeZone: p.weekTimezone } : {}),
  });
  const dateFmt = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const totalAwaiting = p.awaiting.length;

  return (
    <div className="oma-home" data-testid="product-home">
      <header className="oma-home-top">
        <div>
          {p.userName ? (
            <h1 className="oma-home-greeting">{greeting}</h1>
          ) : (
            <Skeleton width="240px" height="28px" />
          )}
          <p className="oma-home-sub">
            {dateFmt.format(now)}
            {!p.loading && totalAwaiting > 0
              ? ` · ${fill(t('home.v2.needsYou'), { n: totalAwaiting })}`
              : ''}
          </p>
        </div>
        <Link
          href={homeLinks.create}
          className="oma-home-btn oma-home-btn--primary"
          data-testid="home-create-post"
        >
          <span aria-hidden="true">+</span> {t('home.v2.createPost')}
        </Link>
      </header>

      {p.error ? (
        <div className="oma-home-error" role="alert">
          <span>{t('home.loadFailed')}</span>
          {p.onRetry ? (
            <button type="button" className="oma-home-btn" onClick={p.onRetry}>
              {t('home.v2.retry')}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="oma-home-brands" data-testid="command-center-workspaces">
        {p.loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="oma-home-card oma-home-brand">
              <Shimmer rows={2} height="20px" />
            </div>
          ))
        ) : p.brands.length === 0 ? (
          <div className="oma-home-card oma-home-empty">
            <p>{t('home.v2.noBrands')}</p>
            <Link href="/app/brands/new" className="oma-home-btn">
              {t('brand.list.create')}
            </Link>
          </div>
        ) : (
          p.brands.map((b) => (
            <Link
              key={b.id}
              href={homeLinks.brand(b.id)}
              className="oma-home-card oma-home-brand"
              data-testid="home-brand-card"
            >
              <div className="oma-home-brand__head">
                <BrandAvatar name={b.name} logo={b.logo_url} />
                <div className="oma-home-brand__id">
                  <strong className="oma-home-ellipsis">{b.name}</strong>
                  <span className="oma-home-nets">
                    {brandNetworks(b).length ? (
                      brandNetworks(b).map((c) => (
                        <NetworkIcon key={c} channel={c} size={16} title={c} />
                      ))
                    ) : (
                      <span className="oma-home-muted">{t('home.v2.noChannels')}</span>
                    )}
                  </span>
                </div>
              </div>
              <ul className="oma-home-brand__stats">
                <li>
                  <span className="oma-home-dot oma-home-dot--warn" aria-hidden="true" />
                  <b>{b.awaiting_approval}</b> {t('home.v2.awaitingApproval')}
                </li>
                <li>
                  <span className="oma-home-dot oma-home-dot--info" aria-hidden="true" />
                  <b>{b.scheduled_this_week}</b> {t('home.v2.scheduledWeek')}
                </li>
              </ul>
            </Link>
          ))
        )}
      </div>

      <div className="oma-home-layout">
        <div className="oma-home-main">
          <Card
            id="home-waiting-heading"
            title={
              <>
                {t('home.v2.waitingTitle')}
                {!p.loading ? <span className="oma-home-count">{totalAwaiting}</span> : null}
              </>
            }
            action={
              <Link href="/app/reviews" className="oma-home-link">
                {t('home.v2.viewAll')}
              </Link>
            }
          >
            <div data-testid="home-pending-reviews">
              {p.loading ? (
                <Shimmer rows={3} />
              ) : p.awaiting.length === 0 ? (
                <p className="oma-home-empty-line" role="status">
                  {t('home.v2.waitingEmpty')}
                </p>
              ) : (
                <ul className="oma-home-list">
                  {p.awaiting.map((item) => {
                    const caption = pick(item.caption, locale) || pick(item.title, locale);
                    return (
                      <li key={item.id} className="oma-home-post">
                        <Link href={item.href} className="oma-home-post__link">
                          <Thumb url={item.thumbnail_url} channel={item.channel} size="md" />
                          <div className="oma-home-post__body">
                            <div className="oma-home-post__meta">
                              <NetworkIcon channel={item.channel} size={16} />
                              <strong className="oma-home-ellipsis">{item.brand ?? ''}</strong>
                              <span className="oma-home-muted oma-home-ellipsis">
                                {item.requested_by ? `· ${item.requested_by} ` : ''}·{' '}
                                {relTime(item.requested_at, now, locale)}
                                {item.progress.required > 1
                                  ? ` · ${item.progress.approved}/${item.progress.required}`
                                  : ''}
                              </span>
                            </div>
                            <p className="oma-home-post__caption">{caption}</p>
                          </div>
                        </Link>
                        {p.canApprove ? (
                          <button
                            type="button"
                            className="oma-home-approve"
                            aria-label={fill(t('home.v2.approveAria'), {
                              name: caption.slice(0, 60),
                            })}
                            title={t('home.v2.approve')}
                            onClick={() => p.onApprove(item)}
                            data-testid="home-quick-approve"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M5 12.5l4.5 4.5L19 7.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <h3 className="oma-home-subtitle">{t('home.v2.commentsTitle')}</h3>
            {p.loading ? (
              <Shimmer rows={2} height="40px" />
            ) : p.comments.length === 0 ? (
              <p className="oma-home-empty-line" role="status">
                {t('home.v2.commentsEmpty')}
              </p>
            ) : (
              <ul className="oma-home-list">
                {p.comments.map((c) => {
                  const label = t(`shell.notification.${c.type}`);
                  const inner = (
                    <>
                      <span className="oma-home-person" aria-hidden="true">
                        {c.actor ? initials(c.actor) : '@'}
                      </span>
                      <div className="oma-home-row__body">
                        <div className="oma-home-ellipsis">
                          {c.actor ? <strong>{c.actor} </strong> : null}
                          <span className="oma-home-muted">
                            {label !== `shell.notification.${c.type}`
                              ? label
                              : t('shell.notification.generic')}
                            {c.context ? ` · ${pick(c.context, locale)}` : ''} ·{' '}
                            {relTime(c.at, now, locale)}
                          </span>
                        </div>
                        {c.body ? (
                          <p className="oma-home-row__text">{pick(c.body, locale)}</p>
                        ) : null}
                      </div>
                      {c.unread ? (
                        <span className="oma-home-unread" aria-label={t('home.v2.unread')} />
                      ) : null}
                    </>
                  );
                  return (
                    <li key={c.id}>
                      {c.href ? (
                        <Link href={c.href} className="oma-home-row">
                          {inner}
                        </Link>
                      ) : (
                        <div className="oma-home-row">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            id="home-week-heading"
            title={t('home.v2.weekTitle')}
            action={
              <Link href={homeLinks.day(days[0]!.key)} className="oma-home-link">
                {t('home.v2.openCalendar')}
              </Link>
            }
          >
            <div className="oma-home-week" data-testid="home-schedule-week">
              {days.map((d) => (
                <Link
                  key={d.key}
                  href={homeLinks.day(d.key)}
                  className={`oma-home-day${d.isToday ? ' oma-home-day--today' : ''}`}
                  aria-label={`${dayFmt.format(d.date)} · ${fill(t('home.v2.postsCount'), { n: d.items.length })}`}
                >
                  <span className="oma-home-day__label">{dayFmt.format(d.date)}</span>
                  {p.loading ? (
                    <Skeleton height="44px" />
                  ) : d.items.length === 0 ? (
                    <span className="oma-home-muted oma-home-day__none">
                      {t('home.v2.noPosts')}
                    </span>
                  ) : (
                    <>
                      {d.items.slice(0, 3).map((it) => (
                        <span key={it.id} className="oma-home-day__post">
                          <Thumb url={it.thumbnail_url} channel={it.channel} size="sm" />
                          <span className="oma-home-day__time">
                            {timeFmt.format(new Date(it.scheduled_at))}
                          </span>
                        </span>
                      ))}
                      {d.items.length > 3 ? (
                        <span className="oma-home-muted oma-home-day__more">
                          {fill(t('home.v2.morePosts'), { n: d.items.length - 3 })}
                        </span>
                      ) : null}
                    </>
                  )}
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <aside className="oma-home-side">
          {p.setup.visible ? (
            <section
              className="oma-home-card oma-home-setup"
              aria-labelledby="home-setup-heading"
              data-testid="home-setup"
            >
              <button
                type="button"
                className="oma-home-x"
                aria-label={t('home.v2.dismissSetup')}
                onClick={p.setup.onDismiss}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <h2 id="home-setup-heading" className="oma-home-card__title">
                {fill(t('home.v2.setupTitle'), { done: progress.done, total: progress.total })}
              </h2>
              <div
                className="oma-home-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
              >
                <i
                  style={{ inlineSize: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
                />
              </div>
              <ul className="oma-home-steps">
                {p.setup.steps.map((s) => (
                  <li key={s.id} className={s.done ? 'is-done' : ''}>
                    <span className="oma-home-check" aria-hidden="true">
                      {s.done ? '✓' : ''}
                    </span>
                    {s.done ? (
                      <span>{t(`home.gettingStarted.${s.id}`)}</span>
                    ) : (
                      <Link href={s.href}>{t(`home.gettingStarted.${s.id}`)}</Link>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" className="oma-home-btn" onClick={p.setup.onDismiss}>
                {t('home.v2.dismiss')}
              </button>
            </section>
          ) : null}

          <Card
            id="home-activity-heading"
            title={t('home.v2.activityTitle')}
            action={
              <Link href="/app/activity" className="oma-home-link">
                {t('home.v2.viewAll')}
              </Link>
            }
          >
            {p.loading ? (
              <Shimmer rows={3} height="36px" />
            ) : p.activityError ? (
              <p className="oma-home-empty-line" role="alert">
                {t('home.v2.activityFailed')}
              </p>
            ) : p.activity.length === 0 ? (
              <p className="oma-home-empty-line" role="status">
                {t('home.v2.activityEmpty')}
              </p>
            ) : (
              <ul className="oma-home-list">
                {p.activity.slice(0, 5).map((a) => (
                  <li key={a.id} className="oma-home-row">
                    <span className="oma-home-person" aria-hidden="true">
                      {initials(a.actor_name)}
                    </span>
                    <div className="oma-home-row__body">
                      <div>
                        <strong>{a.actor_name}</strong> <span>{activityVerb(t, a)}</span>
                        {a.target ? (
                          <span className="oma-home-muted"> {pick(a.target.name, locale)}</span>
                        ) : null}
                      </div>
                      <span className="oma-home-muted">{relTime(a.at, now, locale)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
      {p.feedback}
    </div>
  );
}
