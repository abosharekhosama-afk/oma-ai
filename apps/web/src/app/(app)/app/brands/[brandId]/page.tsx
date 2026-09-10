'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../lib/api';
import type { BrandDetail, Paginated, ScanDetail } from '../../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../lib/brand-api';
import { SelectCompany } from '../../../../../components/shell/select-company';
import { BrandWorkspaceShell } from '../../../../../components/brand/brand-workspace-shell';
import { ConnectorModeChip } from '../../../../../components/brand/connector-mode-banner';
import { CoverageDisclosure } from '../../../../../components/brand/coverage-disclosure';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { Panel } from '../../../../../components/ui/page-header';
import { ErrorState, Skeleton } from '../../../../../components/ui/empty-state';
import { useT } from '../../../../../lib/use-locale';

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
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId]);

  const journey = useMemo(() => {
    if (!brand) return [];
    const scan = brand.latest_scan;
    return [
      {
        id: 'connect',
        label: t('brand.detail.journeyConnect'),
        state: brand.website ? ('done' as const) : ('current' as const),
      },
      {
        id: 'scan',
        label: t('brand.detail.journeyScan'),
        state: scan ? ('done' as const) : brand.website ? ('current' as const) : ('todo' as const),
      },
      {
        id: 'discover',
        label: t('brand.detail.journeyDiscover'),
        state: scan
          ? brand.current_approved_profile_version_id
            ? ('done' as const)
            : ('current' as const)
          : ('todo' as const),
      },
      {
        id: 'intel',
        label: t('brand.detail.journeyIntelligence'),
        state: brand.current_approved_profile_version_id
          ? ('done' as const)
          : scan
            ? ('current' as const)
            : ('todo' as const),
      },
    ];
  }, [brand, t]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (loading) {
    return (
      <div className="oma-stack" role="status" aria-label={t('common.loading')}>
        <Skeleton height="3rem" />
        <Skeleton height="10rem" />
      </div>
    );
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
  const nextStep = !brand.website
    ? { href: `/app/brands/${brandId}/connect`, label: t('brand.detail.connectCta') }
    : !scan
      ? { href: `/app/brands/${brandId}/scans/new`, label: t('brand.scan.start') }
      : brand.current_approved_profile_version_id
        ? {
            href: `/app/brands/${brandId}/profiles/${brand.current_approved_profile_version_id}`,
            label: t('brand.detail.viewProfile'),
          }
        : {
            href: `/app/brands/${brandId}/profiles`,
            label: t('brand.detail.intelligenceCta'),
          };

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      brandStatus={brand.status}
      websiteUrl={brand.website?.normalized_url}
      scanStatus={scan?.status}
      latestScanId={scan?.id}
      nextStepHref={nextStep.href}
      nextStepLabel={nextStep.label}
      journey={journey}
    >
      <div className="oma-workboard-split">
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
            </dl>
          </Panel>

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
              <div className="oma-table-wrap">
                <table className="oma-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('brand.scan.historyStatus')}</th>
                      <th scope="col">{t('brand.scan.historyProgress')}</th>
                      <th scope="col">{t('brand.scan.historyActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanHistory.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <StatusChip status={item.status} />
                        </td>
                        <td>{item.progress_percent}%</td>
                        <td>
                          <Link href={`/app/brands/${brandId}/scans/${item.id}`}>
                            {t('brand.scan.historyOpen')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                  <Link href={`/app/brands/${brandId}/discovery/pages`} className="oma-work-row">
                    <strong>{t('brand.discovery.pagesTitle')}</strong>
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
            </ul>
          </Panel>
        </aside>
      </div>
    </BrandWorkspaceShell>
  );
}
