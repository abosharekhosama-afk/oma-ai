'use client';
import { DetailShimmer } from '../../../../../components/ui/shimmer';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
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
import { BrandPipelineOutcome } from '../../../../../components/brand/brand-pipeline-outcome';
import { BrandHubCard } from '../../../../../components/brand/brand-hub-card';

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

  const journey = useMemo(() => (brand ? buildBrandJourneySteps(brand, t) : []), [brand, t]);

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
  const nextStep = brandPrimaryNextStep(brandId, brand, t);

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
      <div className="oma-workboard-split oma-brand-detail-workboard">
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
                      <ConnectorModeChip mode={scan.connector_mode} />
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
                  ) : brand.current_approved_profile_version_id ? (
                    <Link href={`/app/brands/${brandId}/strategies/new`}>
                      {t('brand.detail.createStrategyCta')}
                    </Link>
                  ) : (
                    <span className="oma-muted">{t('brand.detail.noStrategy')}</span>
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          <BrandPipelineOutcome brandId={brandId} brand={brand} scan={scanDetail} />

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
        </div>

        <aside className="oma-workboard-side">
          <Panel title={t('home.needsActionTitle')} priority labelledBy="brand-next-steps">
            <ul className="oma-dense-list">
              <li>
                <Link href={nextStep.href} className="oma-work-row">
                  <strong>{nextStep.label}</strong>
                  <span className="oma-work-row-cta" aria-hidden="true">
                    {t('home.action.open')}
                  </span>
                </Link>
              </li>
              {scan ? (
                <li>
                  <Link href={`/app/brands/${brandId}/discovery`} className="oma-work-row">
                    <strong>{t('brand.discovery.hubTitle')}</strong>
                    <span className="oma-work-row-cta" aria-hidden="true">
                      {t('home.action.open')}
                    </span>
                  </Link>
                </li>
              ) : null}
              <li>
                <Link href={`/app/brands/${brandId}/profiles`} className="oma-work-row">
                  <strong>{t('brand.detail.intelligenceCta')}</strong>
                  <span className="oma-work-row-cta" aria-hidden="true">
                    {t('home.action.open')}
                  </span>
                </Link>
              </li>
              {brand.current_approved_profile_version_id ? (
                <li>
                  <Link
                    href={
                      brand.current_approved_strategy_id
                        ? `/app/brands/${brandId}/strategies/${brand.current_approved_strategy_id}`
                        : `/app/brands/${brandId}/strategies`
                    }
                    className="oma-work-row"
                  >
                    <strong>
                      {brand.current_approved_strategy_id
                        ? t('brand.detail.openStrategyCta')
                        : t('brand.detail.createStrategyCta')}
                    </strong>
                    <span className="oma-work-row-cta" aria-hidden="true">
                      {t('home.action.open')}
                    </span>
                  </Link>
                </li>
              ) : null}
            </ul>
          </Panel>
        </aside>
      </div>
    </BrandWorkspaceShell>
  );
}
