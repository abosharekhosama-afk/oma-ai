'use client';

import { DetailShimmer } from '../../../../../../components/ui/shimmer';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail, ScanDetail } from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { BrandHubCard } from '../../../../../../components/brand/brand-hub-card';
import { StatusChip, statusLabel } from '../../../../../../components/ui/status-chip';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { buildBrandJourneySteps } from '../../../../../../lib/brand-journey';
import { useT } from '../../../../../../lib/use-locale';

export default function BrandEvidenceHubPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [tenantRequired, setTenantRequired] = useState(false);

  useEffect(() => {
    void api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`)
      .then(async (res) => {
        setBrand(res.data);
        const latest = res.data.latest_scan?.id;
        if (latest) {
          const scanRes = await api<{ data: ScanDetail }>(
            `/api/v1/brands/${brandId}/scans/${latest}`,
          );
          setScan(scanRes.data);
        }
      })
      .catch((err) => {
        if (isTenantRequired(err)) setTenantRequired(true);
        else if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      })
      .finally(() => setLoading(false));
  }, [brandId]);

  const journey = useMemo(() => (brand ? buildBrandJourneySteps(brand, t) : []), [brand, t]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (tenantRequired) return <SelectCompany />;
  if (loading) return <DetailShimmer />;
  if (error || !brand) {
    return (
      <div className="oma-plx-listening-card" role="alert">
        {error ?? t('common.notFound')}
      </div>
    );
  }

  const base = `/app/brands/${brandId}`;
  const scanHref = brand.latest_scan?.id
    ? `${base}/scans/${brand.latest_scan.id}`
    : `${base}/scans/new`;

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
      <header className="oma-plx-brand-page-head">
        <h2>{t('brand.evidence.hubTitle')}</h2>
        <p className="oma-muted">{t('brand.evidence.hubBody')}</p>
      </header>
      <div className="oma-plx-brand-hub-grid" data-testid="brand-evidence-hub">
        <BrandHubCard
          href={`${base}/connect`}
          title={t('brand.nav.website')}
          description={brand.website?.normalized_url ?? t('brand.evidence.websiteEmpty')}
          meta={
            brand.website ? (
              <span className="oma-muted">{t('brand.evidence.websiteLinked')}</span>
            ) : null
          }
          foot={t('home.action.open')}
          testId="brand-hub-website"
        />
        <BrandHubCard
          href={scanHref}
          title={t('brand.nav.scan')}
          description={
            brand.latest_scan
              ? `${statusLabel(t, brand.latest_scan.status)}${
                  scan?.progress_percent != null ? ` · ${scan.progress_percent}%` : ''
                }`
              : t('brand.evidence.scanEmpty')
          }
          meta={brand.latest_scan ? <StatusChip status={brand.latest_scan.status} /> : null}
          foot={t('home.action.open')}
          testId="brand-hub-scan"
        />
        <BrandHubCard
          href={`${base}/discovery`}
          title={t('brand.nav.discovery')}
          description={t('brand.evidence.discoveryHint')}
          meta={
            scan?.discovery_summary ? (
              <span className="oma-muted">
                {scan.discovery_summary.pages ?? 0} {t('brand.discovery.statsPages')}
              </span>
            ) : null
          }
          foot={t('home.action.open')}
          testId="brand-hub-discovery"
        />
      </div>
    </BrandWorkspaceShell>
  );
}
