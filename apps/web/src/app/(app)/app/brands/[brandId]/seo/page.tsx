'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../../../../lib/api';
import { apiMutate } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
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
  const [health, setHealth] = useState<SeoHealthResponse['data'] | null>(null);
  const [analytics, setAnalytics] = useState<SeoAnalytics['data'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, a] = await Promise.all([
        api<SeoHealthResponse>(`/api/v1/brands/${brandId}/seo/health`),
        api<SeoAnalytics>(`/api/v1/brands/${brandId}/seo/analytics?period=30`),
      ]);
      setHealth(h.data);
      setAnalytics(a.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  }, [brandId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const syncGsc = async () => {
    setBusy(true);
    try {
      await apiMutate(`/api/v1/brands/${brandId}/seo/search-console/sync`, { method: 'POST' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const connectFixture = async () => {
    setBusy(true);
    try {
      await apiMutate(`/api/v1/brands/${brandId}/seo/search-console/connect-fixture`, {
        method: 'POST',
        body: {},
      });
      await syncGsc();
    } finally {
      setBusy(false);
    }
  };

  return (
    <BrandWorkspaceShell brandId={brandId} section="evidence">
      <div className="oma-stack oma-stack--lg" data-testid="brand-seo-page">
        <header>
          <h1 className="oma-page-title">{t('brand.seo.title')}</h1>
          <p className="oma-page-lead">{t('brand.seo.lead')}</p>
        </header>

        {error ? <p className="oma-callout oma-callout--error">{error}</p> : null}

        <section className="oma-card oma-card--padded">
          <h2 className="oma-heading-sm">{t('brand.seo.siteHealth')}</h2>
          {health?.audit ? (
            <p>
              {t('brand.seo.score')}: <strong>{health.audit.score}</strong> — {health.audit.findings_count}{' '}
              {t('brand.seo.findings')}
            </p>
          ) : (
            <p className="oma-text-muted">{t('brand.seo.noAudit')}</p>
          )}
        </section>

        <section className="oma-card oma-card--padded">
          <h2 className="oma-heading-sm">{t('brand.seo.searchConsole')}</h2>
          <p className="oma-text-muted">
            {t('brand.seo.gscStatus')}: {health?.search_console.status ?? '—'} ({health?.search_console.gsc_mode})
          </p>
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
        </section>

        <section className="oma-card oma-card--padded">
          <h2 className="oma-heading-sm">{t('brand.seo.visibility')}</h2>
          {analytics ? (
            <ul className="oma-list-plain">
              <li>
                {t('brand.seo.gscClicks')}: {analytics.totals.gsc_clicks} / {t('brand.seo.impressions')}:{' '}
                {analytics.totals.gsc_impressions}
              </li>
              <li>
                {t('brand.seo.publishedPosts')}: {analytics.totals.published_posts}
              </li>
            </ul>
          ) : null}
          {analytics?.search_queries?.length ? (
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
          ) : (
            <p className="oma-text-muted">{t('brand.seo.noQueries')}</p>
          )}
        </section>
      </div>
    </BrandWorkspaceShell>
  );
}