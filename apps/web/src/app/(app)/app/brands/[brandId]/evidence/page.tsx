'use client';

import { DetailShimmer } from '../../../../../../components/ui/shimmer';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail, ScanDetail } from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied, isTenantRequired } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { BrandHubCard } from '../../../../../../components/brand/brand-hub-card';
import { StatusChip } from '../../../../../../components/ui/status-chip';
import { BrandPlxPageHead } from '../../../../../../components/brand/brand-plx-section';
import { formatBrandDateTime } from '../../../../../../lib/brand-format';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { SelectCompany } from '../../../../../../components/shell/select-company';
import { buildBrandJourneySteps } from '../../../../../../lib/brand-journey';
import { useLocale, useT } from '../../../../../../lib/use-locale';

export default function BrandEvidenceHubPage() {
  const t = useT();
  const locale = useLocale();
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
      <BrandPlxPageHead
        title={t('brand.evidence.hubTitle')}
        description={t('brand.evidence.hubBody')}
      />
      <div className="oma-plx-brand-hub-grid" data-testid="brand-evidence-hub">
        <BrandHubCard
          href={`${base}/connect`}
          title={t('brand.nav.website')}
          description={brand.website?.normalized_url ?? t('brand.evidence.websiteEmpty')}
          descriptionDir={brand.website ? 'ltr' : undefined}
          meta={
            brand.website ? (
              <StatusChip status={brand.website.validation_status} />
            ) : (
              <StatusChip tone="warning" label={t('brand.evidence.websiteMissing')} />
            )
          }
          foot={brand.website ? t('brand.evidence.manageWebsite') : t('brand.detail.connectCta')}
          testId="brand-hub-website"
        />
        <BrandHubCard
          href={scanHref}
          title={t('brand.nav.scan')}
          description={
            scan
              ? t('brand.evidence.scanFacts')
                  .replace('{percent}', String(scan.progress_percent))
                  .replace('{fetched}', String(scan.pages_fetched))
                  .replace(
                    '{date}',
                    formatBrandDateTime(scan.finished_at ?? scan.started_at, locale),
                  )
              : t('brand.evidence.scanEmpty')
          }
          meta={brand.latest_scan ? <StatusChip status={brand.latest_scan.status} /> : null}
          foot={brand.latest_scan ? t('brand.evidence.openScan') : t('brand.scan.start')}
          testId="brand-hub-scan"
        />
        <BrandHubCard
          href={`${base}/discovery`}
          title={t('brand.nav.discovery')}
          description={
            scan?.discovery_summary
              ? t('brand.evidence.discoveryFacts')
                  .replace('{pages}', String(scan.discovery_summary.pages))
                  .replace('{products}', String(scan.discovery_summary.products))
                  .replace('{services}', String(scan.discovery_summary.services))
              : t('brand.evidence.discoveryHint')
          }
          foot={t('brand.evidence.openDiscovery')}
          testId="brand-hub-discovery"
        />
      </div>
    </BrandWorkspaceShell>
  );
}
