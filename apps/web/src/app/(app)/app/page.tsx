'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/use-locale';
import type { BrandListItem, Paginated } from '../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../lib/brand-api';
import {
  brandAttention,
  brandPrimaryHref,
  isBrandNeedingAction,
} from '../../../lib/brand-attention';
import { StatusChip } from '../../../components/ui/status-chip';

type Me = { user: { name: string }; active_tenant_id: string | null };

type NotificationItem = {
  id: string;
  type: string;
  deepLinkPath: string | null;
  createdAt: string;
  readAt: string | null;
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

export default function AppHomePage() {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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
        const [brandRes, notifRes] = await Promise.all([
          api<Paginated<BrandListItem>>('/api/v1/brands'),
          api<{ items: NotificationItem[] }>('/api/v1/notifications').catch(() => ({
            items: [] as NotificationItem[],
          })),
        ]);
        if (cancelled) return;
        setBrands(brandRes.data);
        setNotifications(notifRes.items.slice(0, 5));
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
    <div className="oma-stack oma-product-home" data-testid="product-home">
      <header className="oma-page-header oma-page-header-stack">
        <div>
          <p className="oma-kicker">{t('home.kicker')}</p>
          <h1>{t('home.title')}</h1>
          <p className="oma-muted oma-lead">{t('home.subtitle')}</p>
        </div>
        {me?.active_tenant_id ? (
          <div className="oma-header-actions">
            <Link href="/app/brands/new" className="oma-btn">
              {t('brand.list.create')}
            </Link>
            <Link href="/app/brands" className="oma-btn oma-btn-secondary">
              {t('home.viewPortfolio')}
            </Link>
          </div>
        ) : null}
      </header>

      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="oma-skeleton-grid" role="status" aria-label={t('common.loading')}>
          <div className="oma-skeleton" />
          <div className="oma-skeleton" />
          <div className="oma-skeleton" />
        </div>
      ) : !me ? null : !me.active_tenant_id ? (
        <div className="oma-card oma-empty-state" role="status">
          <h2>{t('home.noTenantTitle')}</h2>
          <p className="oma-muted">{t('home.noTenantBody')}</p>
          <Link href="/app/onboarding" className="oma-btn">
            {t('shell.emptyMembershipCta')}
          </Link>
        </div>
      ) : denied ? (
        <div className="oma-card" role="status">
          <p className="oma-muted">{t('errors.permission')}</p>
        </div>
      ) : (
        <>
          <section className="oma-stat-strip" aria-label={t('home.summaryLabel')}>
            <div className="oma-stat">
              <span className="oma-stat-value">{brands.length}</span>
              <span className="oma-stat-label">{t('home.stat.brands')}</span>
            </div>
            <div className="oma-stat">
              <span className="oma-stat-value">{needingAction.length}</span>
              <span className="oma-stat-label">{t('home.stat.needsAction')}</span>
            </div>
            <div className="oma-stat">
              <span className="oma-stat-value">{approvedCount}</span>
              <span className="oma-stat-label">{t('home.stat.approved')}</span>
            </div>
            <div className="oma-stat">
              <span className="oma-stat-value">{scanningCount}</span>
              <span className="oma-stat-label">{t('home.stat.inProgress')}</span>
            </div>
          </section>

          <div className="oma-home-grid">
            <section className="oma-card" aria-labelledby="needs-action-heading">
              <div className="oma-section-head">
                <h2 id="needs-action-heading">{t('home.needsActionTitle')}</h2>
                <p className="oma-muted">{t('home.needsActionBody')}</p>
              </div>
              {needingAction.length === 0 ? (
                <p className="oma-muted" role="status">
                  {t('home.needsActionEmpty')}
                </p>
              ) : (
                <ul className="oma-action-list">
                  {needingAction.slice(0, 6).map((brand) => (
                    <li key={brand.id}>
                      <Link href={brandPrimaryHref(brand)} className="oma-action-row">
                        <div>
                          <strong>{brand.name}</strong>
                          <div className="oma-chip-row">
                            <StatusChip status={brand.status} />
                            {brand.latest_scan_status ? (
                              <StatusChip status={brand.latest_scan_status} />
                            ) : null}
                            {brand.latest_profile_status ? (
                              <StatusChip status={brand.latest_profile_status} />
                            ) : null}
                          </div>
                        </div>
                        <span className="oma-action-cta">{attentionLabel(t, brand)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="oma-card" aria-labelledby="portfolio-heading">
              <div className="oma-section-head">
                <h2 id="portfolio-heading">{t('home.portfolioTitle')}</h2>
                <p className="oma-muted">{t('home.portfolioBody')}</p>
              </div>
              {brands.length === 0 ? (
                <div className="oma-empty-state" role="status">
                  <p>{t('brand.list.emptyBody')}</p>
                  <Link href="/app/brands/new" className="oma-btn">
                    {t('brand.list.create')}
                  </Link>
                </div>
              ) : (
                <ul className="oma-compact-list">
                  {brands.slice(0, 5).map((brand) => (
                    <li key={brand.id}>
                      <Link href={`/app/brands/${brand.id}`} className="oma-compact-row">
                        <strong>{brand.name}</strong>
                        <span className="oma-muted oma-ltr">
                          {brand.primary_website_url ?? t('brand.list.noWebsite')}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/app/brands" className="oma-text-link">
                {t('home.viewPortfolio')}
              </Link>
            </section>

            <section className="oma-card" aria-labelledby="journey-heading">
              <div className="oma-section-head">
                <h2 id="journey-heading">{t('home.journeyTitle')}</h2>
                <p className="oma-muted">{t('home.journeyBody')}</p>
              </div>
              <ol className="oma-journey-steps">
                <li>{t('home.journey.step1')}</li>
                <li>{t('home.journey.step2')}</li>
                <li>{t('home.journey.step3')}</li>
                <li>{t('home.journey.step4')}</li>
                <li>{t('home.journey.step5')}</li>
              </ol>
            </section>

            <section className="oma-card" aria-labelledby="activity-heading">
              <div className="oma-section-head">
                <h2 id="activity-heading">{t('home.activityTitle')}</h2>
                <p className="oma-muted">{t('home.activityBody')}</p>
              </div>
              {notifications.length === 0 ? (
                <p className="oma-muted" role="status">
                  {t('home.activityEmpty')}
                </p>
              ) : (
                <ul className="oma-compact-list">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      {n.deepLinkPath ? (
                        <Link href={n.deepLinkPath} className="oma-compact-row">
                          <strong>{n.type}</strong>
                          <span className="oma-muted">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </Link>
                      ) : (
                        <div className="oma-compact-row">
                          <strong>{n.type}</strong>
                          <span className="oma-muted">
                            {new Date(n.createdAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
