'use client';

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
import { DemoDisclosure } from '../../../components/demo/demo-disclosure';
import { demoApi, isDemoForbidden, pickCopy } from '../../../lib/demo/use-demo-api';
import type { DemoGraph } from '@oma/demo';

type Me = { user: { name: string }; active_tenant_id: string | null };

type NotificationItem = {
  id: string;
  type: string;
  deepLinkPath: string | null;
  createdAt: string;
  readAt: string | null;
};

type DemoCommandCenter = DemoGraph['commandCenter'] & {
  brands: DemoGraph['brands'];
  campaigns: DemoGraph['campaigns'];
  meta: DemoGraph['meta'];
};

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
  const key = `shell.notification.type.${type}`;
  const translated = t(key);
  return translated === key ? type : translated;
}

export default function AppHomePage() {
  const t = useT();
  const locale = useLocale();
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [demoCc, setDemoCc] = useState<DemoCommandCenter | null>(null);
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
        const [brandRes, notifRes, demoRes] = await Promise.all([
          api<Paginated<BrandListItem>>('/api/v1/brands'),
          api<{ items: NotificationItem[] }>('/api/v1/notifications').catch(() => ({
            items: [] as NotificationItem[],
          })),
          demoApi<DemoCommandCenter>('/command-center').catch((err) => {
            if (isDemoForbidden(err)) return null;
            return null;
          }),
        ]);
        if (cancelled) return;
        setBrands(brandRes.data);
        setNotifications(notifRes.items.slice(0, 8));
        setDemoCc(demoRes);
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
  const strategyReady = approvedCount;

  return (
    <div className="oma-stack oma-workboard oma-product-home" data-testid="product-home">
      <PageHeader
        kicker={t('home.kicker')}
        title={t('home.title')}
        description={t('home.subtitle')}
        actions={
          me?.active_tenant_id ? (
            <>
              <Link href="/app/brands/new" className="oma-btn">
                {t('brand.list.create')}
              </Link>
              <Link href="/app/brands" className="oma-btn oma-btn-secondary">
                {t('home.viewPortfolio')}
              </Link>
            </>
          ) : null
        }
      />

      {error ? <ErrorState title={t('common.error')} body={error} /> : null}

      {loading ? (
        <div className="oma-stack" role="status" aria-label={t('common.loading')}>
          <Skeleton height="2.5rem" />
          <Skeleton height="12rem" />
          <Skeleton height="8rem" />
        </div>
      ) : !me ? null : !me.active_tenant_id ? (
        <EmptyState
          title={t('home.noTenantTitle')}
          body={t('home.noTenantBody')}
          action={
            <Link href="/app/onboarding" className="oma-btn">
              {t('shell.emptyMembershipCta')}
            </Link>
          }
        />
      ) : denied ? (
        <DeniedState title={t('errors.permission')} />
      ) : (
        <>
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
            <span className="oma-metric-pill">
              <strong>{strategyReady}</strong> {t('home.stat.strategyReady')}
            </span>
            {demoCc ? (
              <>
                <span className="oma-metric-pill">
                  <strong>{demoCc.reviewQueueCount}</strong> {t('home.demoReviewQueue')}
                </span>
                <span className="oma-metric-pill">
                  <strong>{demoCc.overdueTasks}</strong> {t('home.demoOverdue')}
                </span>
                {typeof demoCc.scheduleThisWeek === 'number' ? (
                  <Link
                    href="/app/schedule"
                    className="oma-metric-pill"
                    data-testid="home-schedule-week"
                  >
                    <strong>{demoCc.scheduleThisWeek}</strong> {t('home.demoScheduleWeek')}
                  </Link>
                ) : null}
                {typeof demoCc.workloadAtRisk === 'number' ? (
                  <Link
                    href="/app/team"
                    className="oma-metric-pill"
                    data-testid="home-workload-risk"
                  >
                    <strong>{demoCc.workloadAtRisk}</strong> {t('home.demoWorkloadRisk')}
                  </Link>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="oma-workboard-split">
            <div className="oma-workboard-primary">
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
                              <span>{new Date(brand.updated_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <span className="oma-work-row-cta">{attentionLabel(t, brand)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {demoCc ? (
                <Panel
                  title={t('home.demoNextActions')}
                  description={t('demo.disclosure')}
                  labelledBy="demo-next-heading"
                  action={<span className="oma-badge oma-badge--warning">Demo</span>}
                >
                  <div data-testid="demo-command-center">
                    <ul className="oma-dense-list">
                      {demoCc.nextActions.map((a) => (
                        <li key={a.href}>
                          <Link href={a.href} className="oma-work-row">
                            <strong>{pickCopy(a.label, locale)}</strong>
                            <span className="oma-work-row-cta">{t('home.action.open')}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>
              ) : null}

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
                {brands.length === 0 ? (
                  <EmptyState
                    title={t('brand.list.emptyTitle')}
                    body={t('brand.list.emptyBody')}
                    action={
                      <Link href="/app/brands/new" className="oma-btn">
                        {t('brand.list.create')}
                      </Link>
                    }
                  />
                ) : (
                  <ul className="oma-dense-list">
                    {brands.slice(0, 6).map((brand) => (
                      <li key={brand.id}>
                        <Link href={`/app/brands/${brand.id}`} className="oma-work-row">
                          <div>
                            <strong>{brand.name}</strong>
                            <div className="oma-work-row-meta">
                              <StatusChip status={brand.status} />
                              <span className="oma-ltr">
                                {brand.primary_website_url ?? t('brand.list.noWebsite')}
                              </span>
                              {brand.current_approved_profile_version_id ? (
                                <StatusChip tone="success" label={t('brand.versions.current')} />
                              ) : null}
                            </div>
                          </div>
                          <span className="oma-work-row-cta">{t('home.action.open')}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <aside className="oma-workboard-side">
              {demoCc ? (
                <>
                  <div className="oma-banner-demo">
                    <DemoDisclosure />
                  </div>
                  <Panel title={t('home.demoDeadlines')} labelledBy="demo-deadlines-heading">
                    <ul className="oma-dense-list">
                      {demoCc.upcomingDeadlines.map((d) => (
                        <li key={d.href + d.at}>
                          <Link href={d.href} className="oma-work-row">
                            <div>
                              <strong>{pickCopy(d.label, locale)}</strong>
                              <div className="oma-work-row-meta">
                                <span>{d.at}</span>
                              </div>
                            </div>
                            <span className="oma-work-row-cta">{t('home.action.open')}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                  <Panel
                    title={t('home.demoProgress')}
                    labelledBy="demo-campaigns-heading"
                    action={
                      <Link href="/app/campaigns" className="oma-text-link">
                        {t('nav.campaigns')}
                      </Link>
                    }
                  >
                    <ul className="oma-dense-list">
                      {demoCc.campaigns.map((c) => (
                        <li key={c.id}>
                          <Link href={`/app/campaigns/${c.id}`} className="oma-work-row">
                            <div>
                              <strong>{pickCopy(c.name, locale)}</strong>
                              <div className="oma-work-row-meta">
                                <StatusChip status={c.status} />
                                <span
                                  className={
                                    c.track === 'PAID'
                                      ? 'oma-track-pill oma-track-pill--paid'
                                      : 'oma-track-pill oma-track-pill--organic'
                                  }
                                >
                                  {c.track}
                                </span>
                              </div>
                            </div>
                            <span className="oma-work-row-cta">{t('home.action.open')}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                  <Panel
                    title={t('home.demoPerformance')}
                    labelledBy="demo-perf-heading"
                    action={<span className="oma-badge oma-badge--warning">Demo</span>}
                  >
                    <p style={{ margin: 0 }}>{pickCopy(demoCc.performanceBlurb, locale)}</p>
                    <p style={{ marginTop: '0.75rem' }}>
                      <Link href="/app/analytics" className="oma-text-link">
                        {t('nav.analytics')}
                      </Link>
                    </p>
                  </Panel>
                </>
              ) : null}

              <Panel
                title={t('home.activityTitle')}
                description={t('home.activityBody')}
                labelledBy="activity-heading"
                action={
                  <Link href="/app/reviews" className="oma-text-link">
                    {t('nav.reviews')}
                  </Link>
                }
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
                                <span>{new Date(n.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                            <span className="oma-work-row-cta">{t('home.action.open')}</span>
                          </Link>
                        ) : (
                          <div className="oma-work-row">
                            <div>
                              <strong>{notificationLabel(t, n.type)}</strong>
                              <div className="oma-work-row-meta">
                                <span>{new Date(n.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title={t('home.strategyStatusTitle')} labelledBy="strategy-status-heading">
                <ul className="oma-dense-list">
                  <li>
                    <div className="oma-work-row">
                      <div>
                        <strong>{t('home.strategyReadyCount')}</strong>
                        <div className="oma-work-row-meta">
                          <span>
                            {strategyReady} / {brands.length}
                          </span>
                        </div>
                      </div>
                      <Link href="/app/brands" className="oma-work-row-cta">
                        {t('home.action.open')}
                      </Link>
                    </div>
                  </li>
                  <li>
                    <div className="oma-work-row">
                      <div>
                        <strong>{t('nav.reviews')}</strong>
                        <div className="oma-work-row-meta">
                          <span>{demoCc?.reviewQueueCount ?? needingAction.length}</span>
                        </div>
                      </div>
                      <Link href="/app/reviews" className="oma-work-row-cta">
                        {t('home.action.open')}
                      </Link>
                    </div>
                  </li>
                </ul>
              </Panel>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
