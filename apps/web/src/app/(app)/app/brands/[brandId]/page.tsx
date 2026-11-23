'use client';
import { DetailShimmer } from '../../../../../components/ui/shimmer';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../lib/api';
import type { BrandDetail, Paginated, ScanDetail } from '../../../../../lib/brand-types';
import {
  getApiError,
  isNotFound,
  isPermissionDenied,
  isTenantRequired,
} from '../../../../../lib/brand-api';
import { SelectCompany } from '../../../../../components/shell/select-company';
import { BrandWorkspaceShell } from '../../../../../components/brand/brand-workspace-shell';
import { ConnectorModeChip } from '../../../../../components/brand/connector-mode-banner';
import { CoverageDisclosure } from '../../../../../components/brand/coverage-disclosure';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';
import { StatusChip, statusLabel } from '../../../../../components/ui/status-chip';
import { Panel } from '../../../../../components/ui/page-header';
import { ErrorState } from '../../../../../components/ui/empty-state';
import { useT } from '../../../../../lib/use-locale';
import { buildBrandJourneySteps, brandPrimaryNextStep } from '../../../../../lib/brand-journey';
import {
  loadBrandPipelineHints,
  type BrandPipelineHints,
} from '../../../../../lib/brand-pipeline-hints';
import {
  StrategyContentHandoffBanner,
  StrategyPlanHandoffBanner,
} from '../../../../../components/brand/brand-context-banners';
import { BrandPipelineOutcome } from '../../../../../components/brand/brand-pipeline-outcome';
import { BrandHubCard } from '../../../../../components/brand/brand-hub-card';
import { hasBrandContent, hasPlanRequestsCommitted } from '../../../../../lib/brand-pipeline-hints';

const SCAN_TERMINAL = new Set(['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED']);
const SCAN_POLL_MS = 2000;

export default function BrandDetailPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [scanDetail, setScanDetail] = useState<ScanDetail | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);
  const [pipelineHints, setPipelineHints] = useState<BrandPipelineHints | null>(null);

  const refreshActiveScan = useCallback(
    async (scanId: string) => {
      const scan = await api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${scanId}`);
      setScanDetail(scan.data);
      setScanHistory((prev) => prev.map((row) => (row.id === scan.data.id ? scan.data : row)));
      setBrand((prev) =>
        prev?.latest_scan?.id === scan.data.id
          ? { ...prev, latest_scan: { ...prev.latest_scan, ...scan.data } }
          : prev,
      );
    },
    [brandId],
  );

  useEffect(() => {
    api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then(async (res) => {
        setBrand(res.data);
        try {
          const history = await api<Paginated<ScanDetail>>(
            `/api/v1/brands/${brandId}/scans?limit=20`,
          );
          setScanHistory(history.data);
        } catch {
          setScanHistory([]);
        }
        if (res.data.latest_scan?.id) {
          try {
            const scan = await api<{ data: ScanDetail }>(
              `/api/v1/brands/${brandId}/scans/${res.data.latest_scan.id}`,
            );
            setScanDetail(scan.data);
          } catch {
            setScanDetail(null);
          }
        }
      })
      .catch((err) => {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err) || isNotFound(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId]);

  useEffect(() => {
    const scanId = scanDetail?.id;
    const status = scanDetail?.status;
    if (!scanId || !status || SCAN_TERMINAL.has(status)) return;
    const id = window.setInterval(() => {
      refreshActiveScan(scanId).catch(() => undefined);
    }, SCAN_POLL_MS);
    return () => window.clearInterval(id);
  }, [scanDetail?.id, scanDetail?.status, refreshActiveScan]);

  useEffect(() => {
    if (!brand?.current_approved_strategy_id) {
      setPipelineHints(null);
      return;
    }
    void loadBrandPipelineHints(brandId)
      .then(setPipelineHints)
      .catch(() => setPipelineHints({ work_request_count: 0, content_count: 0 }));
  }, [brandId, brand?.current_approved_strategy_id]);

  const journey = useMemo(
    () => (brand ? buildBrandJourneySteps(brand, t, pipelineHints) : []),
    [brand, t, pipelineHints],
  );

  if (denied)
    return <PermissionDenied message={t('errors.brandNoAccess') || t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (loading) {
    return <DetailShimmer />;
  }
  if (error || !brand) {
    return (
      <ErrorState
        title={t('common.error')}
        body={error ?? t('common.notFound')}
        action={<Link href="/app/brands">{t('brand.create.back')}</Link>}
      />
    );
  }

  const scan = brand.latest_scan;
  const nextStep = brandPrimaryNextStep(brandId, brand, t, pipelineHints);

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      brandLogoUrl={brand.logo_url}
      brandStatus={brand.status}
      websiteUrl={brand.website?.normalized_url}
      scanStatus={scan?.status}
      latestScanId={scan?.id}
      nextStepHref={nextStep.href}
      nextStepLabel={nextStep.label}
      journey={journey}
    >
      <h2 className="oma-sr-only">{t('brand.detail.overview')}</h2>
      <div
        className="oma-plx-brand-hub-grid oma-plx-brand-hub-grid--compact"
        data-testid="brand-overview-hubs"
      >
        <BrandHubCard
          href={`/app/brands/${brandId}/evidence`}
          title={t('brand.nav.evidence')}
          description={t('brand.overview.evidenceCard')}
          meta={scan ? <StatusChip status={scan.status} /> : undefined}
          foot={t('home.action.open')}
          testId="brand-overview-evidence"
        />
        <BrandHubCard
          href={`/app/brands/${brandId}/intelligence`}
          title={t('brand.nav.strategyHub')}
          description={t('brand.overview.strategyCard')}
          meta={
            brand.current_approved_profile_version_id ? <StatusChip status="APPROVED" /> : undefined
          }
          foot={t('home.action.open')}
          testId="brand-overview-strategy"
        />
      </div>
      <div className="oma-brand-detail-workboard oma-brand-detail-workboard--single">
        <div className="oma-workboard-primary">
          <Panel title={t('brand.detail.overview')} labelledBy="brand-overview">
            <dl className="oma-detail-dl">
              <div>
                <dt>{t('brand.detail.status')}</dt>
                <dd>
                  <StatusChip status={brand.status} />
                </dd>
              </div>
              <div>
                <dt>{t('brand.detail.website')}</dt>
                <dd>
                  {brand.website ? (
                    <a href={brand.website.normalized_url} className="oma-ltr">
                      {brand.website.normalized_url}
                    </a>
                  ) : (
                    <Link href={`/app/brands/${brandId}/connect`}>
                      {t('brand.detail.connectCta')}
                    </Link>
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('brand.detail.latestScan')}</dt>
                <dd>
                  {scan ? (
                    <>
                      <Link href={`/app/brands/${brandId}/scans/${scan.id}`}>{scan.status}</Link>{' '}
                      <ConnectorModeChip
                        mode={scan.connector_mode}
                        scanHint={{
                          pages_fetched: scanDetail?.pages_fetched,
                          status: scan.status,
                        }}
                      />
                    </>
                  ) : (
                    t('brand.detail.noScan')
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('brand.detail.approvedProfile')}</dt>
                <dd>
                  {brand.current_approved_profile_version_id ? (
                    <Link
                      href={`/app/brands/${brandId}/profiles/${brand.current_approved_profile_version_id}`}
                    >
                      {t('brand.detail.viewProfile')}
                    </Link>
                  ) : (
                    <span className="oma-muted">{t('brand.detail.noApprovedProfile')}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>{t('brand.detail.currentStrategy')}</dt>
                <dd>
                  {brand.current_approved_strategy_id ? (
                    <Link
                      href={`/app/brands/${brandId}/strategies/${brand.current_approved_strategy_id}`}
                    >
                      {t('brand.detail.openStrategyCta')}
                    </Link>
                  ) : (brand.active_strategy_count ?? 0) > 0 ? (
                    <Link href={`/app/brands/${brandId}/strategies`}>
                      {t('brand.detail.continueStrategyCta')}
                    </Link>
                  ) : brand.current_approved_profile_version_id ? (
                    <span className="oma-muted">{t('brand.detail.noStrategy')}</span>
                  ) : (
                    <span className="oma-muted">{t('brand.detail.noStrategy')}</span>
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          {brand.current_approved_strategy_id &&
          pipelineHints &&
          !hasPlanRequestsCommitted(pipelineHints) ? (
            <StrategyPlanHandoffBanner
              brandId={brandId}
              strategyId={brand.current_approved_strategy_id}
            />
          ) : null}
          {pipelineHints &&
          hasPlanRequestsCommitted(pipelineHints) &&
          !hasBrandContent(pipelineHints) ? (
            <StrategyContentHandoffBanner brandId={brandId} />
          ) : null}

          <BrandPipelineOutcome
            brandId={brandId}
            brand={brand}
            scan={scanDetail}
            hints={pipelineHints}
          />

          {scanDetail ? (
            <Panel title={t('brand.coverage.title')} labelledBy="brand-coverage">
              <CoverageDisclosure coverage={scanDetail.coverage} scanStatus={scanDetail.status} />
            </Panel>
          ) : null}

          <Panel title={t('brand.scan.historyTitle')} labelledBy="scan-history-heading">
            {scanHistory.length === 0 ? (
              <p className="oma-muted" role="status">
                {t('brand.scan.historyEmpty')}
              </p>
            ) : (
              <ul className="oma-plx-brand-data-grid">
                {scanHistory.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/app/brands/${brandId}/scans/${item.id}`}
                      className="oma-plx-listening-card oma-plx-brand-catalog-card"
                    >
                      <strong>
                        {item.progress_percent}% · {statusLabel(t, item.status)}
                      </strong>
                      <div className="oma-work-row-meta">
                        <StatusChip status={item.status} />
                        {item.started_at ? (
                          <time dateTime={item.started_at} suppressHydrationWarning>
                            {new Date(item.started_at).toLocaleString()}
                          </time>
                        ) : null}
                      </div>
                      <span className="oma-plx-brand-hub-card__foot">
                        {t('brand.scan.historyOpen')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <nav className="oma-brand-quick-links" aria-label={t('brand.detail.quickLinks')}>
            {scan ? (
              <Link
                href={`/app/brands/${brandId}/discovery`}
                className="oma-brand-quick-links__item"
              >
                {t('brand.discovery.hubTitle')}
              </Link>
            ) : null}
            <Link href={`/app/brands/${brandId}/profiles`} className="oma-brand-quick-links__item">
              {t('brand.detail.intelligenceCta')}
            </Link>
            <Link href={`/app/brands/${brandId}/evidence`} className="oma-brand-quick-links__item">
              {t('brand.nav.evidence')}
            </Link>
          </nav>
        </div>
      </div>
    </BrandWorkspaceShell>
  );
}
