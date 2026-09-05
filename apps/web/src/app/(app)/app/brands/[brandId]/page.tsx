'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../lib/api';
import type { BrandDetail, ScanDetail } from '../../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../lib/brand-api';
import { SelectCompany } from '../../../../../components/shell/select-company';
import { BrandWorkspaceShell } from '../../../../../components/brand/brand-workspace-shell';
import { ConnectorModeChip } from '../../../../../components/brand/connector-mode-banner';
import { CoverageDisclosure } from '../../../../../components/brand/coverage-disclosure';
import { PermissionDenied } from '../../../../../components/shell/permission-denied';
import { StatusChip } from '../../../../../components/ui/status-chip';
import { useT } from '../../../../../lib/use-locale';

export default function BrandDetailPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [scanDetail, setScanDetail] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then(async (res) => {
        setBrand(res.data);
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

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (loading) return <p role="status">{t('common.loading')}</p>;
  if (error || !brand) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)' }}>{error ?? t('common.notFound')}</p>
        <Link href="/app/brands">{t('brand.create.back')}</Link>
      </div>
    );
  }

  const scan = brand.latest_scan;
  const nextStep = !brand.website
    ? {
        href: `/app/brands/${brandId}/connect`,
        label: t('brand.detail.connectCta'),
      }
    : !scan
      ? {
          href: `/app/brands/${brandId}/scans/new`,
          label: t('brand.scan.start'),
        }
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
      scanStatus={scan?.status}
      latestScanId={scan?.id}
      nextStepHref={nextStep.href}
      nextStepLabel={nextStep.label}
    >
      <div className="oma-card">
        <h2>{t('brand.detail.journeyTitle')}</h2>
        <ol className="oma-journey-steps">
          <li>
            {t('brand.detail.journeyConnect')}:{' '}
            {brand.website ? (
              <StatusChip tone="success" label={t('brand.detail.website')} />
            ) : (
              <Link href={`/app/brands/${brandId}/connect`}>{t('brand.detail.connectCta')}</Link>
            )}
          </li>
          <li>
            {t('brand.detail.journeyScan')}:{' '}
            {scan ? (
              <Link href={`/app/brands/${brandId}/scans/${scan.id}`}>
                <StatusChip status={scan.status} />
              </Link>
            ) : (
              <Link href={`/app/brands/${brandId}/scans/new`}>{t('brand.scan.start')}</Link>
            )}
          </li>
          <li>
            {t('brand.detail.journeyDiscover')}:{' '}
            {scan ? (
              <Link href={`/app/brands/${brandId}/discovery/pages`}>
                {t('brand.discovery.pagesTitle')}
              </Link>
            ) : (
              <span className="oma-muted">{t('brand.detail.noScan')}</span>
            )}
          </li>
          <li>
            {t('brand.detail.journeyIntelligence')}:{' '}
            <Link href={`/app/brands/${brandId}/profiles`}>
              {t('brand.detail.intelligenceCta')}
            </Link>
          </li>
        </ol>
      </div>

      <div className="oma-card">
        <h2>{t('brand.detail.overview')}</h2>
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
                <Link href={`/app/brands/${brandId}/connect`}>{t('brand.detail.connectCta')}</Link>
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
          {brand.current_approved_profile_version_id ? (
            <div>
              <dt>{t('brand.detail.approvedProfile')}</dt>
              <dd>
                <Link
                  href={`/app/brands/${brandId}/profiles/${brand.current_approved_profile_version_id}`}
                >
                  {t('brand.detail.viewProfile')}
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      {scanDetail ? (
        <CoverageDisclosure coverage={scanDetail.coverage} scanStatus={scanDetail.status} />
      ) : null}

      <div className="oma-action-grid">
        {!brand.website ? (
          <Link href={`/app/brands/${brandId}/connect`} className="oma-card oma-action-card">
            <strong>{t('brand.detail.connectCta')}</strong>
            <p className="oma-muted">{t('brand.detail.connectHint')}</p>
          </Link>
        ) : (
          <Link href={`/app/brands/${brandId}/scans/new`} className="oma-card oma-action-card">
            <strong>{t('brand.nav.scan')}</strong>
            <p className="oma-muted">{t('brand.scan.setupHint')}</p>
          </Link>
        )}
        {scan ? (
          <>
            <Link
              href={`/app/brands/${brandId}/discovery/pages`}
              className="oma-card oma-action-card"
            >
              <strong>{t('brand.discovery.pagesTitle')}</strong>
              <p className="oma-muted">{t('brand.discovery.pagesHint')}</p>
            </Link>
            <Link
              href={`/app/brands/${brandId}/discovery/products`}
              className="oma-card oma-action-card"
            >
              <strong>{t('brand.discovery.productsTitle')}</strong>
              <p className="oma-muted">{t('brand.discovery.productsHint')}</p>
            </Link>
          </>
        ) : null}
        <Link href={`/app/brands/${brandId}/profiles`} className="oma-card oma-action-card">
          <strong>{t('brand.detail.intelligenceCta')}</strong>
          <p className="oma-muted">{t('brand.detail.intelligenceHint')}</p>
        </Link>
      </div>
    </BrandWorkspaceShell>
  );
}
