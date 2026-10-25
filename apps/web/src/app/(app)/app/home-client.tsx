'use client';
import { OmaLinkButton } from '../../../components/ui/oma-link-button';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useLocale, useT } from '../../../lib/use-locale';
import type { BrandListItem, Paginated } from '../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../lib/brand-api';
import {
  brandAttention,
  brandPrimaryHref,
  isBrandNeedingAction,
} from '../../../lib/brand-attention';
import { StatusChip } from '../../../components/ui/status-chip';
import { PageHeader, Panel } from '../../../components/ui/page-header';
import { EmptyState, ErrorState, DeniedState, Skeleton } from '../../../components/ui/empty-state';
import { WorkspaceCard } from '../../../components/brand/workspace-card';
import {
  ConnectionHonestyPanel,
  GettingStartedChecklist,
  JourneyStrip,
} from '../../../components/shell/getting-started';
import { getHome, type HomeData } from '../../../lib/home-api';

type Me = { user: { name: string }; active_tenant_id: string | null };

type NotificationItem = {
  id: string;
  type: string;
  deepLinkPath: string | null;
  createdAt: string;
  readAt: string | null;
};

const pick = (c: { en: string; ar: string }, locale: string) =>
  locale.toLowerCase().startsWith('ar') ? c.ar || c.en : c.en;

function fmtDate(iso: string | null, locale: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale.toLowerCase().startsWith('ar') ? 'ar' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function attentionLabel(t: (key: string) => string, brand: BrandListItem): string {
  switch (brandAttention(brand)) {
    case 'connect_website':
      return t('home.action.connect');
    case 'start_scan':
      return t('home.action.scan');
    case 'review_partial':
      return t('home.action.reviewScan');
    case 'review_profile':
      return t('home.action.reviewProfile');
    case 'open_approved':
      return t('home.action.viewApproved');
    default:
      return t('home.action.open');
  }
}

function notificationLabel(t: (key: string) => string, type: string): string {
  for (const key of [`shell.notification.${type}`, `shell.notification.type.${type}`]) {
    const translated = t(key);
    if (translated && translated !== key) return translated;
  }
  return t('shell.notification.generic');
}

export default function AppHomePage() {
  const t = useT();
  const locale = useLocale();
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [home, setHome] = useState<HomeData | null>(null);
  const [homeError, setHomeError] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await api<Me>('/api/v1/auth/me');
        if (cancelled) return;
        setMe(next);
        if (!next.active_tenant_id) {
          setLoading(false);
          return;
        }
        const [brandRes, notifRes, homeRes] = await Promise.all([
          api<Paginated<BrandListItem>>('/api/v1/brands'),
          api<{ items: NotificationItem[] }>('/api/v1/notifications').catch(() => ({
            items: [] as NotificationItem[],
          })),
          getHome().catch(() => null),
        ]);
        if (cancelled) return;
        setBrands(brandRes.data);
        setNotifications(notifRes.items.slice(0, 8));
        setHome(homeRes);
        setHomeError(!homeRes);
      } catch (err) {
        if (cancelled) return;
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const needingAction = useMemo(() => brands.filter(isBrandNeedingAction), [brands]);
  const approvedCount = brands.filter((b) => b.current_approved_profile_version_id).length;
  const scanningCount = brands.filter((b) =>
    ['QUEUED', 'RUNNING'].includes(b.latest_scan_status ?? ''),
  ).length;

  return (
    <div className="oma-stack oma-cc oma-surface-cc" data-testid="product-home">
      <PageHeader
        kicker={t('home.kicker')}
        title={t('home.title')}
        description={t('home.subtitle')}
        actions={
          me?.active_tenant_id ? (
            <>
              <OmaLinkButton href="/app/brands/new" type="primary">
                {t('brand.list.create')}
              </OmaLinkButton>
              <OmaLinkButton href="/app/brands" type="default">
                {t('home.viewPortfolio')}
              </OmaLinkButton>
            </>
          ) : null
        }
      />

      {error ? <ErrorState title={t('common.error')} body={error} /> : null}

      {loading ? (
        <div className="oma-stack" role="status" aria-label={t('common.loading')}>
          <Skeleton height="2.5rem" />
          <Skeleton height="12rem" />
        </div>
      ) : !me ? null : !me.active_tenant_id ? (
        <EmptyState
          title={t('home.noTenantTitle')}
          body={t('home.noTenantBody')}
          action={
            <OmaLinkButton href="/app/select-company" type="primary">
              {t('shell.emptyMembershipCta')}
            </OmaLinkButton>
          }
        />
      ) : denied ? (
        <DeniedState title={t('errors.permission')} />
      ) : (
        <>
          <JourneyStrip />
          <GettingStartedChecklist
            hasTenant={Boolean(me.active_tenant_id)}
            brandCount={brands.length}
            approvedProfileCount={approvedCount}
            hasCampaign={Boolean(home && home.counts.active_campaigns > 0)}
            steps={home?.checklist}
          />
          {homeError ? <ErrorState title={t('common.error')} body={t('home.loadFailed')} /> : null}
          <ConnectionHonestyPanel />
          <div className="oma-workboard-split">
            <div className="oma-workboard-primary">
              <Panel
                title={t('home.portfolioTitle')}
                description={t('home.portfolioBody')}
                labelledBy="portfolio-heading"
                action={
                  <Link href="/app/brands" className="oma-text-link">
                    {t('home.viewPortfolio')}
                  </Link>
                }
              >
                <div data-testid="command-center-workspaces">
                  {brands.length === 0 ? (
                    <EmptyState
                      title={t('brand.list.emptyTitle')}
                      body={t('brand.list.emptyBody')}
                      action={
                        <OmaLinkButton href="/app/brands/new" type="primary">
                          {t('brand.list.create')}
                        </OmaLinkButton>
                      }
                    />
                  ) : (
                    <div className="oma-workspace-grid">
                      {brands.slice(0, 8).map((brand) => (
                        <WorkspaceCard key={brand.id} brand={brand} compact />
                      ))}
                    </div>
                  )}
                </div>
              </Panel>

              <Panel
                title={t('home.needsActionTitle')}
                description={t('home.needsActionBody')}
                priority
                labelledBy="needs-action-heading"
                action={
                  <Link href="/app/brands" className="oma-text-link">
                    {t('home.viewPortfolio')}
                  </Link>
                }
              >
                {needingAction.length === 0 ? (
                  <p className="oma-muted" role="status">
                    {t('home.needsActionEmpty')}
                  </p>
                ) : (
                  <ul className="oma-dense-list">
                    {needingAction.slice(0, 8).map((brand) => (
                      <li key={brand.id}>
                        <Link href={brandPrimaryHref(brand)} className="oma-work-row">
                          <div>
                            <strong>{brand.name}</strong>
                            <div className="oma-work-row-meta">
                              <StatusChip status={brand.status} />
                              {brand.latest_scan_status ? (
                                <StatusChip status={brand.latest_scan_status} />
                              ) : null}
                              {brand.latest_profile_status ? (
                                <StatusChip status={brand.latest_profile_status} />
                              ) : null}
                            </div>
                          </div>
                          <span className="oma-work-row-cta">{attentionLabel(t, brand)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {home ? (
                <Panel title={t('home.myTasks')} labelledBy="home-my-tasks-heading">
                  <div data-testid="home-my-tasks">
                    {home.my_tasks.length === 0 ? (
                      <p className="oma-muted" role="status">
                        {t('home.myTasksEmpty')}
                      </p>
                    ) : (
                      <ul className="oma-dense-list">
                        {home.my_tasks.map((task) => (
                          <li key={task.id}>
                            <Link href={task.href} className="oma-work-row">
                              <div>
                                <strong>{pick(task.title, locale)}</strong>
                                <div className="oma-work-row-meta">
                                  <StatusChip status={task.status} />
                                  {task.brand ? <span>{task.brand}</span> : null}
                                  <span data-overdue={task.overdue ? 'true' : 'false'}>
                                    {task.overdue ? t('home.overdue') : t('home.due')} ·{' '}
                                    {fmtDate(task.due_at, locale)}
                                  </span>
                                </div>
                              </div>
                              <span className="oma-work-row-cta">{t('home.action.open')}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Panel>
              ) : null}

              {home ? (
                <Panel title={t('home.pendingReviews')} labelledBy="home-reviews-heading">
                  <div data-testid="home-pending-reviews">
                    {home.pending_reviews.length === 0 ? (
                      <p className="oma-muted" role="status">
                        {t('home.pendingReviewsEmpty')}
                      </p>
                    ) : (
                      <ul className="oma-dense-list">
                        {home.pending_reviews.map((r) => (
                          <li key={r.kind + r.id}>
                            <Link href={r.href} className="oma-work-row">
                              <div>
                                <strong>{pick(r.title, locale)}</strong>
                                <div className="oma-work-row-meta">
                                  <span>{t(`home.kind.${r.kind}`)}</span>
                                  {r.brand ? <span>{r.brand}</span> : null}
                                  {r.progress ? (
                                    <span>
                                      {t('home.approvedOf')
                                        .replace('{a}', String(r.progress.approved))
                                        .replace('{r}', String(r.progress.required))}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <span className="oma-work-row-cta">{t('home.action.open')}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Panel>
              ) : null}
            </div>

            <aside className="oma-workboard-side">
              <div className="oma-metric-rail" aria-label={t('home.summaryLabel')}>
                <span className="oma-metric-pill">
                  <strong>{needingAction.length}</strong> {t('home.stat.needsAction')}
                </span>
                <span className="oma-metric-pill">
                  <strong>{brands.length}</strong> {t('home.stat.brands')}
                </span>
                <span className="oma-metric-pill">
                  <strong>{approvedCount}</strong> {t('home.stat.approved')}
                </span>
                <span className="oma-metric-pill">
                  <strong>{scanningCount}</strong> {t('home.stat.inProgress')}
                </span>
                {home ? (
                  <>
                    <Link href="/app/reviews" className="oma-metric-pill" data-testid="home-pending-reviews-count">
                      <strong>{home.counts.pending_reviews}</strong> {t('home.stat.reviews')}
                    </Link>
                    <Link href="/app/tasks" className="oma-metric-pill" data-testid="home-overdue-tasks-board">
                      <strong>{home.counts.overdue_tasks}</strong> {t('home.stat.overdue')}
                    </Link>
                    <Link href="/app/schedule" className="oma-metric-pill" data-testid="home-schedule-week">
                      <strong>{home.counts.scheduled_this_week}</strong> {t('home.stat.scheduledWeek')}
                    </Link>
                    <Link href="/app/campaigns" className="oma-metric-pill">
                      <strong>{home.counts.active_campaigns}</strong> {t('home.stat.activeCampaigns')}
                    </Link>
                    <Link href="/app/requests" className="oma-metric-pill">
                      <strong>{home.counts.open_requests}</strong> {t('home.stat.openRequests')}
                    </Link>
                  </>
                ) : null}
              </div>

              {home ? (
                <Panel title={t('home.upcomingSchedule')} labelledBy="home-upcoming-heading">
                  <div data-testid="home-upcoming-schedule">
                    {home.upcoming_schedule.length === 0 ? (
                      <p className="oma-muted" role="status">
                        {t('home.upcomingScheduleEmpty')}
                      </p>
                    ) : (
                      <ul className="oma-dense-list">
                        {home.upcoming_schedule.map((c) => (
                          <li key={c.id}>
                            <Link href={c.href} className="oma-work-row">
                              <div>
                                <strong>{pick(c.title, locale)}</strong>
                                <div className="oma-work-row-meta">
                                  <span>{c.channel}</span>
                                  {c.brand ? <span>{c.brand}</span> : null}
                                  <time dateTime={c.scheduled_at ?? undefined} suppressHydrationWarning>
                                    {fmtDate(c.scheduled_at, locale)}
                                  </time>
                                </div>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="oma-muted">{t('home.publishingNotConnected')}</p>
                  </div>
                </Panel>
              ) : null}

              <Panel
                title={t('home.activityTitle')}
                description={t('home.activityBody')}
                labelledBy="activity-heading"
              >
                {notifications.length === 0 ? (
                  <p className="oma-muted" role="status">
                    {t('home.activityEmpty')}
                  </p>
                ) : (
                  <ul className="oma-dense-list">
                    {notifications.map((n) => (
                      <li key={n.id}>
                        {n.deepLinkPath ? (
                          <Link href={n.deepLinkPath} className="oma-work-row">
                            <div>
                              <strong>{notificationLabel(t, n.type)}</strong>
                              <div className="oma-work-row-meta">
                                <span>{me.user.name}</span>
                                <time dateTime={n.createdAt} suppressHydrationWarning>
                                  {new Date(n.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                                </time>
                              </div>
                            </div>
                            <span className="oma-work-row-cta">{t('home.action.open')}</span>
                          </Link>
                        ) : (
                          <div className="oma-work-row">
                            <div>
                              <strong>{notificationLabel(t, n.type)}</strong>
                              <div className="oma-work-row-meta">
                                <span>{me.user.name}</span>
                                <time dateTime={n.createdAt} suppressHydrationWarning>
                                  {new Date(n.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                                </time>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
