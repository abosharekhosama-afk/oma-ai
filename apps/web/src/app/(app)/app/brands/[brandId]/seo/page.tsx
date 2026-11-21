'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { apiMutate, getApiError, isPermissionDenied } from '../../../../../../lib/brand-api';
import type { BrandDetail } from '../../../../../../lib/brand-types';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import {
  BrandPlxPageHead,
  BrandPlxSection,
} from '../../../../../../components/brand/brand-plx-section';
import { DetailShimmer } from '../../../../../../components/ui/shimmer';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { buildBrandJourneySteps } from '../../../../../../lib/brand-journey';
import { useT } from '../../../../../../lib/use-locale';

type SeoHealthResponse = {
  data: {
    audit: {
      score: number;
      findings_count: number;
      findings: Array<{ code: string; severity: string; page_url: string; detail?: string }>;
      metric_source: string;
    } | null;
    search_console: {
      status: string;
      site_url: string | null;
      gsc_mode: string;
      last_sync_at: string | null;
    };
  };
};

type SeoAnalytics = {
  data: {
    site_health_score: number | null;
    totals: { gsc_clicks: number; gsc_impressions: number; published_posts: number };
    search_queries: Array<{
      keyword: string;
      position: number | null;
      clicks: number | null;
      impressions: number | null;
    }>;
    metric_sources: Record<string, string | null>;
  };
};

export default function BrandSeoPage() {
  const { brandId } = useParams<{ brandId: string }>();
  const t = useT();
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [health, setHealth] = useState<SeoHealthResponse['data'] | null>(null);
  const [analytics, setAnalytics] = useState<SeoAnalytics['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gscError, setGscError] = useState<string | null>(null);
  const [gscNotice, setGscNotice] = useState<string | null>(null);
  const [analyticsDenied, setAnalyticsDenied] = useState(false);
  const [denied, setDenied] = useState(false);

  const loadSeo = useCallback(async () => {
    setAnalyticsDenied(false);
    setError(null);
    const [healthRes, analyticsRes] = await Promise.allSettled([
      api<SeoHealthResponse>(`/api/v1/brands/${brandId}/seo/health`),
      api<SeoAnalytics>(`/api/v1/brands/${brandId}/seo/analytics?period=30`),
    ]);
    if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
    else setError(getApiError(healthRes.reason).message);
    if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data);
    else if (isPermissionDenied(analyticsRes.reason)) setAnalyticsDenied(true);
    else if (healthRes.status === 'fulfilled') setError(getApiError(analyticsRes.reason).message);
  }, [brandId]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const brandRes = await api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`);
      setBrand(brandRes.data);
      await loadSeo();
    } catch (e) {
      if (isPermissionDenied(e)) setDenied(true);
      else setError(getApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [brandId, loadSeo]);

  useEffect(() => {
    void load();
  }, [load]);

  const journey = useMemo(() => (brand ? buildBrandJourneySteps(brand, t) : []), [brand, t]);

  const syncGsc = async () => {
    setBusy(true);
    setGscError(null);
    try {
      await apiMutate(`/api/v1/brands/${brandId}/seo/search-console/sync`, { method: 'POST' });
      await loadSeo();
      setGscError(null);
      setGscNotice(null);
    } catch (e) {
      setGscError(isPermissionDenied(e) ? t('brand.seo.gscDenied') : getApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  const connectFixture = async () => {
    setBusy(true);
    setGscError(null);
    setGscNotice(null);
    try {
      await apiMutate(`/api/v1/brands/${brandId}/seo/search-console/connect-fixture`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await apiMutate(`/api/v1/brands/${brandId}/seo/search-console/sync`, { method: 'POST' });
      await loadSeo();
      setGscNotice(t('brand.seo.gscConnected'));
    } catch (e) {
      setGscError(isPermissionDenied(e) ? t('brand.seo.gscDenied') : getApiError(e).message);
    } finally {
      setBusy(false);
    }
  };

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <DetailShimmer />;
  if (!brand) {
    return (
      <div className="oma-plx-listening-card" role="alert">
        {error ?? t('common.notFound')}
      </div>
    );
  }

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      brandLogoUrl={brand.logo_url}
      websiteUrl={brand.website?.normalized_url}
      scanStatus={brand.latest_scan?.status}
      latestScanId={brand.latest_scan?.id}
      journey={journey}
    >
      <div className="oma-seo-page" data-testid="brand-seo-page">
        <BrandPlxPageHead title={t('brand.seo.title')} description={t('brand.seo.lead')} />

        {error ? (
          <p className="oma-callout oma-callout--warning" role="alert">
            {error}
          </p>
        ) : null}

        <BrandPlxSection title={t('brand.seo.siteHealth')} testId="brand-seo-health">
          {health?.audit ? (
            <>
              <p>
                {t('brand.seo.score')}: <strong>{health.audit.score}</strong> —{' '}
                {health.audit.findings_count} {t('brand.seo.findings')}
              </p>
              {health.audit.findings.length > 0 ? (
                <ul className="oma-list-plain">
                  {health.audit.findings
                    .filter((f) => f.severity === 'critical' || f.severity === 'warning')
                    .slice(0, 8)
                    .map((f) => (
                      <li key={`${f.page_url}-${f.code}`}>
                        <code>{f.code}</code> — <span dir="auto">{f.page_url}</span>
                      </li>
                    ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="oma-muted">{t('brand.seo.noAudit')}</p>
          )}
        </BrandPlxSection>

        <BrandPlxSection title={t('brand.seo.searchConsole')} testId="brand-seo-gsc">
          <p className="oma-muted">
            {t('brand.seo.gscStatus')}: {health?.search_console.status ?? '—'} (
            {health?.search_console.gsc_mode ?? '—'})
          </p>
          {gscNotice ? (
            <p
              className="oma-callout oma-callout--success"
              role="status"
              data-testid="brand-seo-gsc-notice"
            >
              {gscNotice}
            </p>
          ) : null}
          {gscError ? (
            <p
              className="oma-callout oma-callout--warning"
              role="alert"
              data-testid="brand-seo-gsc-error"
            >
              {gscError}
            </p>
          ) : null}
          <div className="oma-chip-row">
            <button
              type="button"
              className="oma-btn oma-btn--secondary"
              disabled={busy}
              onClick={() => void connectFixture()}
            >
              {t('brand.seo.connectFixture')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn--primary"
              disabled={busy}
              onClick={() => void syncGsc()}
            >
              {t('brand.seo.syncGsc')}
            </button>
          </div>
        </BrandPlxSection>

        <BrandPlxSection title={t('brand.seo.visibility')} testId="brand-seo-visibility">
          {analyticsDenied ? (
            <p className="oma-muted">{t('brand.seo.analyticsDenied')}</p>
          ) : analytics ? (
            <ul className="oma-list-plain">
              <li>
                {t('brand.seo.gscClicks')}: {analytics.totals.gsc_clicks} /{' '}
                {t('brand.seo.impressions')}: {analytics.totals.gsc_impressions}
              </li>
              <li>
                {t('brand.seo.publishedPosts')}: {analytics.totals.published_posts}
              </li>
            </ul>
          ) : (
            <p className="oma-muted">{t('brand.seo.noQueries')}</p>
          )}
          {!analyticsDenied && analytics?.search_queries?.length ? (
            <table className="oma-table oma-table--compact">
              <thead>
                <tr>
                  <th>{t('brand.seo.keyword')}</th>
                  <th>{t('brand.seo.position')}</th>
                  <th>{t('brand.seo.clicks')}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.search_queries.map((row) => (
                  <tr key={row.keyword}>
                    <td dir="auto">{row.keyword}</td>
                    <td>{row.position?.toFixed(1) ?? '—'}</td>
                    <td>{row.clicks ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : !analyticsDenied ? (
            <p className="oma-muted">{t('brand.seo.noQueries')}</p>
          ) : null}
        </BrandPlxSection>
      </div>
    </BrandWorkspaceShell>
  );
}
