'use client';
import { DetailShimmer } from '../../../../../../../components/ui/shimmer';

import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import {
  apiMutate,
  getApiError,
  isPermissionDenied,
  newIdempotencyKey,
} from '../../../../../../../lib/brand-api';
import type { BrandDetail, ScanDetail } from '../../../../../../../lib/brand-types';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { AiUnavailableBanner } from '../../../../../../../components/brand/ai-unavailable-banner';
import { BrandBackLink } from '../../../../../../../components/brand/brand-section-nav';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { StatusChip, statusLabel } from '../../../../../../../components/ui/status-chip';
import { CoverageDisclosure } from '../../../../../../../components/brand/coverage-disclosure';
import { useLocale, useT } from '../../../../../../../lib/use-locale';
import { errorCodeLabel, formatBrandDateTime } from '../../../../../../../lib/brand-format';
import {
  BrandPlxSection,
  BrandPlxStatGrid,
} from '../../../../../../../components/brand/brand-plx-section';
import { buildBrandJourneySteps } from '../../../../../../../lib/brand-journey';

const TERMINAL = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED']);
const PHASES = ['QUEUED', 'CRAWLING', 'EXTRACTING', 'ANALYZING'] as const;
const POLL_MS = 2000;

function phaseIndex(status: string): number {
  if (status === 'SUCCEEDED' || status === 'PARTIAL') return PHASES.length;
  if (status === 'FAILED' || status === 'CANCELLED') {
    const i = PHASES.indexOf(status as (typeof PHASES)[number]);
    return i >= 0 ? i : Math.max(0, PHASES.length - 1);
  }
  const i = PHASES.indexOf(status as (typeof PHASES)[number]);
  return i >= 0 ? i : 0;
}

export default function ScanDetailPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ brandId: string; scanId: string }>();
  const { brandId, scanId } = params;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [platformAiAvailability, setPlatformAiAvailability] = useState<
    'AVAILABLE' | 'NOT_CONFIGURED' | 'BUDGET_EXHAUSTED' | null
  >(null);
  const liveRef = useRef<HTMLDivElement>(null);
  const lastAnnounced = useRef('');
  const pollFailRef = useRef(0);
  const [networkOnline, setNetworkOnline] = useState(true);
  const [syncLost, setSyncLost] = useState(false);

  const loadScan = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setNetworkOnline(false);
      setSyncLost(true);
      throw new Error('offline');
    }
    setNetworkOnline(true);
    const res = await api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${scanId}`);
    setScan(res.data);
    pollFailRef.current = 0;
    setSyncLost(false);
    return res.data;
  }, [brandId, scanId]);

  useEffect(() => {
    const goOnline = () => {
      setNetworkOnline(true);
      void loadScan().catch(() => undefined);
    };
    const goOffline = () => {
      setNetworkOnline(false);
      setSyncLost(true);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setNetworkOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [loadScan]);

  useEffect(() => {
    Promise.all([api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`), loadScan()])
      .then(([brandRes]) => setBrand(brandRes.data))
      .catch((err) => {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId, loadScan]);

  useEffect(() => {
    void api<{ data?: { availability?: 'AVAILABLE' | 'NOT_CONFIGURED' | 'BUDGET_EXHAUSTED' } }>(
      '/api/v1/ai/status',
    )
      .then((res) => setPlatformAiAvailability(res.data?.availability ?? 'NOT_CONFIGURED'))
      .catch(() => setPlatformAiAvailability('NOT_CONFIGURED'));
  }, []);

  useEffect(() => {
    if (
      !scan ||
      (TERMINAL.has(scan.status) &&
        scan.analysis_status !== 'QUEUED' &&
        scan.analysis_status !== 'ANALYZING')
    )
      return;
    const id = window.setInterval(() => {
      loadScan().catch(() => {
        pollFailRef.current += 1;
        if (pollFailRef.current >= 2) setSyncLost(true);
      });
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [scan, loadScan]);

  useEffect(() => {
    if (!scan || !liveRef.current) return;
    const msg = t('brand.scan.progressLive')
      .replace('{status}', statusLabel(t, scan.status))
      .replace('{percent}', String(scan.progress_percent));
    if (msg !== lastAnnounced.current) {
      lastAnnounced.current = msg;
      liveRef.current.textContent = msg;
    }
  }, [scan, t]);

  async function handleAnalyze() {
    setBusy(true);
    setActionError(null);
    try {
      await apiMutate(`/api/v1/brands/${brandId}/scans/${scanId}/analyze`, {
        method: 'POST',
        body: JSON.stringify({}),
        idempotencyKey: newIdempotencyKey('brand:scan-analyze'),
      });
      await loadScan();
    } catch (err) {
      setActionError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiMutate<{ data: ScanDetail }>(
        `/api/v1/brands/${brandId}/scans/${scanId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      setScan(res.data);
    } catch (err) {
      setActionError(getApiError(err).message);
      await loadScan().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await apiMutate<{ data: { scan_attempt_id: string } }>(
        `/api/v1/brands/${brandId}/scans/${scanId}/retry`,
        {
          method: 'POST',
          body: JSON.stringify({}),
          idempotencyKey: newIdempotencyKey('brand:scan-retry'),
        },
      );
      router.push(`/app/brands/${brandId}/scans/${res.data.scan_attempt_id}`);
    } catch (err) {
      setActionError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <DetailShimmer />;
  if (error || !brand || !scan) {
    return (
      <div className="oma-banner oma-banner-danger" role="alert">
        <p>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  const isPartial = scan.status === 'PARTIAL';
  const isFailed = scan.status === 'FAILED';
  const isCancelled = scan.status === 'CANCELLED';
  const canRetry = ['FAILED', 'PARTIAL', 'CANCELLED'].includes(scan.status);
  const inProgress = !TERMINAL.has(scan.status);
  const activePhase = phaseIndex(scan.status);
  const scanComplete = TERMINAL.has(scan.status) && scan.status !== 'CANCELLED';
  const analysisRunning = scan.analysis_status === 'QUEUED' || scan.analysis_status === 'ANALYZING';
  const canRequestAnalysis =
    scanComplete && !analysisRunning && scan.analysis_status !== 'ANALYZED';
  const crawlLabel = translated(t, `brand.scan.outcome.crawl.${scan.status}`, scan.status);
  const aiKey =
    !scan.analysis_status ||
    scan.analysis_status === 'NOT_REQUESTED' ||
    scan.analysis_status === 'SKIPPED'
      ? 'NOT_RUN'
      : scan.analysis_status;
  const aiLabel = translated(t, `brand.scan.outcome.ai.${aiKey}`, statusLabel(t, aiKey));
  const failure = errorCodeLabel(t, scan.error_code);
  const summary = scan.discovery_summary;
  const productsFound = summary
    ? summary.products + summary.services
    : (scan.coverage?.products_discovered ?? 0) + (scan.coverage?.services_discovered ?? 0);
  const sitemapUrlsQueued = scan.coverage?.sitemap_urls_queued ?? 0;
  const sitemapDocumentsFetched = scan.coverage?.sitemap_documents_fetched ?? 0;
  const showSitemapPhase =
    inProgress && scan.status === 'CRAWLING' && scan.progress_percent <= 8;

  const journey = buildBrandJourneySteps(brand, t);

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      brandLogoUrl={brand.logo_url}
      websiteUrl={brand.website?.normalized_url}
      scanStatus={scan.status}
      latestScanId={scan.id}
      journey={journey}
    >
      <BrandBackLink href={`/app/brands/${brandId}/evidence`} label={t('brand.nav.evidenceHub')} />
      <div className="oma-plx-brand-status-rail oma-plx-brand-status-rail--scan">
        <AiUnavailableBanner
          aiAvailability={scan.ai_availability}
          analysisStatus={scan.analysis_status}
          analysisErrorCode={scan.analysis_error_code}
          platformAvailability={platformAiAvailability}
          canRequestAnalysis={canRequestAnalysis}
          onRequestAnalysis={canRequestAnalysis ? () => void handleAnalyze() : undefined}
          requestBusy={busy}
        />
      </div>

      <BrandPlxSection
        title={t('brand.scan.progressTitle')}
        description={t('brand.scan.phasesSubtitle')}
        testId="scan-progress-section"
      >
        <div
          ref={liveRef}
          className="oma-sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        />
        <data value={scan.status} data-testid="scan-status" hidden>
          {scan.status}
        </data>

        <div className="oma-scan-hero">
          <div className="oma-scan-hero__percent" aria-hidden="true">
            {scan.progress_percent}%
          </div>
          <dl className="oma-scan-hero__facts">
            <div>
              <dt>{t('brand.scan.crawlOutcomeLabel')}</dt>
              <dd>
                <StatusChip status={scan.status} label={crawlLabel} />
              </dd>
            </div>
            <div>
              <dt>{t('brand.scan.aiOutcomeLabel')}</dt>
              <dd>
                <StatusChip status={aiKey === 'NOT_RUN' ? null : aiKey} label={aiLabel} />
                <span className="oma-sr-only" data-testid="scan-analysis-status-readable">
                  {aiLabel}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t('brand.scan.startedAt')}</dt>
              <dd>{formatBrandDateTime(scan.started_at, locale)}</dd>
            </div>
            <div>
              <dt>{t('brand.scan.finishedAt')}</dt>
              <dd>
                {scan.finished_at
                  ? formatBrandDateTime(scan.finished_at, locale)
                  : t('brand.scan.stillRunning')}
              </dd>
            </div>
          </dl>
        </div>

        <ol className="oma-scan-phases" aria-label={t('brand.scan.phasesTitle')}>
          {PHASES.map((phase, index) => {
            const done = activePhase > index || TERMINAL.has(scan.status);
            const current = scan.status === phase;
            return (
              <li
                key={phase}
                className={
                  current
                    ? 'oma-scan-phase is-current'
                    : done
                      ? 'oma-scan-phase is-done'
                      : 'oma-scan-phase'
                }
                aria-current={current ? 'step' : undefined}
              >
                <StatusChip
                  status={current ? scan.status : done ? 'SUCCEEDED' : 'QUEUED'}
                  label={t(`brand.scan.phase.${phase}`)}
                />
              </li>
            );
          })}
        </ol>

        <div
          className="oma-progress"
          role="progressbar"
          aria-label={t('brand.scan.pipelineProgressLabel')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={scan.progress_percent}
        >
          <div className="oma-progress-bar" style={{ width: `${scan.progress_percent}%` }} />
        </div>
        <p className="oma-sr-only" role="status" data-testid="scan-status-summary">
          {t('brand.scan.statusSummary')
            .replace('{crawl}', crawlLabel)
            .replace('{ai}', aiLabel)
            .replace('{percent}', String(scan.progress_percent))}
        </p>

        {inProgress && !networkOnline ? (
          <div
            className="oma-banner oma-banner-warning"
            role="alert"
            data-testid="scan-offline-banner"
          >
            <strong>{t('brand.scan.offlineTitle')}</strong>
            <p>{t('brand.scan.offlineBody')}</p>
          </div>
        ) : null}
        {inProgress && networkOnline && syncLost ? (
          <div
            className="oma-banner oma-banner-warning"
            role="alert"
            data-testid="scan-sync-lost-banner"
          >
            <strong>{t('brand.scan.syncLostTitle')}</strong>
            <p>{t('brand.scan.syncLostBody')}</p>
          </div>
        ) : null}
        {inProgress && networkOnline && !syncLost ? (
          <p className="oma-muted" role="status" data-testid="scan-live-sync">
            <span className="oma-scan-live-dot" aria-hidden="true">
              ●
            </span>{' '}
            {t('brand.scan.liveSyncLabel')}
          </p>
        ) : null}
        {showSitemapPhase ? (
          <p className="oma-muted" role="status" data-testid="scan-sitemap-phase-hint">
            {t('brand.scan.sitemapPhaseHint')}
          </p>
        ) : null}

        {isPartial ? (
          <div className="oma-banner oma-banner-warning" role="alert">
            <strong>{t('brand.scan.partialTitle')}</strong>
            <p>{t('brand.scan.partialBody')}</p>
          </div>
        ) : null}
        {isFailed ? (
          <div className="oma-banner oma-banner-danger" role="alert">
            <strong>{t('brand.scan.failedTitle')}</strong>
            <p>{failure ?? t('brand.scan.failedBody')}</p>
            {scan.error_code ? (
              <details className="oma-brand-tech-details">
                <summary>{t('brand.common.technicalDetails')}</summary>
                <code className="oma-ltr">{scan.error_code}</code>
                {scan.error_detail ? (
                  <pre className="oma-ltr oma-brand-tech-details__detail">{scan.error_detail}</pre>
                ) : null}
              </details>
            ) : null}
          </div>
        ) : null}
        {isCancelled ? (
          <div className="oma-banner oma-banner-warning" role="status">
            <strong>{t('brand.scan.cancelledTitle')}</strong>
            <p>{t('brand.scan.cancelledBody')}</p>
          </div>
        ) : null}
        {inProgress && scan.stalled ? (
          <div
            className="oma-banner oma-banner-warning"
            role="alert"
            data-testid="scan-stalled-banner"
          >
            <strong>{t('brand.scan.stalledTitle')}</strong>
            <p>{t('brand.scan.stalledBody')}</p>
          </div>
        ) : null}

        <BrandPlxStatGrid
          stats={[
            { label: t('brand.scan.pagesFetched'), value: scan.pages_fetched },
            { label: t('brand.scan.pagesFailed'), value: scan.pages_failed },
            { label: t('brand.scan.pagesSkipped'), value: scan.pages_skipped },
            { label: t('brand.scan.catalogFound'), value: productsFound },
            ...(scan.coverage?.pages_js_rendered != null
              ? [{ label: t('brand.scan.pagesJsRendered'), value: scan.coverage.pages_js_rendered }]
              : []),
            ...(scan.product_media_imported != null
              ? [
                  {
                    label: t('brand.scan.productMediaImported'),
                    value: scan.product_media_imported,
                  },
                ]
              : []),
            ...(sitemapUrlsQueued > 0
              ? [{ label: t('brand.scan.sitemapUrlsQueued'), value: sitemapUrlsQueued }]
              : []),
            ...(sitemapDocumentsFetched > 0
              ? [
                  {
                    label: t('brand.scan.sitemapDocumentsFetched'),
                    value: sitemapDocumentsFetched,
                  },
                ]
              : []),
          ]}
        />
        {actionError ? (
          <p role="alert" className="oma-brand-inline-error">
            {actionError}
          </p>
        ) : null}
        <div className="oma-form-actions oma-scan-actions">
          {inProgress ? (
            <Button type="default" disabled={busy} onClick={() => void handleCancel()}>
              {t('brand.scan.cancel')}
            </Button>
          ) : null}
          {canRetry ? (
            <Button type="primary" disabled={busy} onClick={() => void handleRetry()}>
              {t('brand.scan.retry')}
            </Button>
          ) : null}
          {scan.profile_version_id && scanComplete && !analysisRunning ? (
            <Button type="default" disabled={busy} onClick={() => void handleAnalyze()}>
              {t('brand.ai.rerun')}
            </Button>
          ) : null}
          {scan.profile_version_id ? (
            <OmaLinkButton
              href={`/app/brands/${brandId}/profiles/${scan.profile_version_id}`}
              type="primary"
            >
              {t('brand.scan.viewProfile')}
            </OmaLinkButton>
          ) : null}
        </div>
      </BrandPlxSection>

      {scanComplete ? (
        <Link
          href={`/app/brands/${brandId}/discovery${productsFound > 0 ? '/products' : ''}`}
          className="oma-plx-listening-card oma-scan-next"
          data-testid="scan-next-discovery"
        >
          <div>
            <strong>{t('brand.scan.nextDiscoveryTitle')}</strong>
            <p className="oma-muted">
              {t('brand.scan.nextDiscoveryBody')
                .replace('{pages}', String(summary?.pages ?? scan.pages_fetched))
                .replace('{products}', String(productsFound))}
            </p>
          </div>
          <span className="oma-plx-brand-hub-card__foot" aria-hidden="true">
            {t('home.action.open')}
          </span>
        </Link>
      ) : null}

      <CoverageDisclosure coverage={scan.coverage} />
    </BrandWorkspaceShell>
  );
}

function translated(t: (key: string) => string, key: string, fallback: string): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}
