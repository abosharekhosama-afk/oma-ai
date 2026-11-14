'use client';
import { DetailShimmer } from '../../../../../../components/ui/shimmer';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail, ScanDetail } from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { BrandPipelineOutcome } from '../../../../../../components/brand/brand-pipeline-outcome';
import { ScanContentOutlook } from '../../../../../../components/brand/scan-content-outlook';
import {
  BrandPlxSection,
  BrandPlxStatGrid,
} from '../../../../../../components/brand/brand-plx-section';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../lib/use-locale';
import { buildBrandJourneySteps } from '../../../../../../lib/brand-journey';

export default function DiscoveryHubPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const brandRes = await api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`);
        setBrand(brandRes.data);
        const latest = brandRes.data.latest_scan?.id;
        if (latest) {
          const scanRes = await api<{ data: ScanDetail }>(
            `/api/v1/brands/${brandId}/scans/${latest}`,
          );
          setScan(scanRes.data);
        }
      } catch (err) {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [brandId]);

  const journey = useMemo(() => (brand ? buildBrandJourneySteps(brand, t) : []), [brand, t]);

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <DetailShimmer />;
  if (!brand) {
    return (
      <div className="oma-card" role="alert">
        {error ?? t('common.notFound')}
      </div>
    );
  }

  const summary = scan?.discovery_summary;

  return (
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      brandLogoUrl={brand.logo_url}
      scanStatus={brand.latest_scan?.status}
      latestScanId={brand.latest_scan?.id}
      journey={journey}
    >
      <BrandPlxSection
        title={t('brand.discovery.hubTitle')}
        description={t('brand.discovery.hubBody')}
      >
        {!brand.latest_scan ? (
          <p role="status">{t('brand.discovery.noScan')}</p>
        ) : (
          <>
            <BrandPlxStatGrid
              testId="discovery-summary-stats"
              stats={[
                { label: t('brand.discovery.statsPages'), value: summary?.pages ?? '—' },
                { label: t('brand.discovery.statsProducts'), value: summary?.products ?? '—' },
                { label: t('brand.discovery.statsServices'), value: summary?.services ?? '—' },
                {
                  label: t('brand.discovery.statsScanPages'),
                  value: scan
                    ? t('brand.discovery.statsScanFetched')
                        .replace('{fetched}', String(scan.pages_fetched))
                        .replace(
                          '{max}',
                          String(scan.coverage?.scan_max_pages ?? scan.pages_fetched),
                        )
                    : '—',
                },
              ]}
            />

            <div className="oma-plx-brand-hub-grid oma-plx-brand-hub-grid--compact">
              <Link
                href={`/app/brands/${brandId}/discovery/pages`}
                className="oma-plx-listening-card oma-plx-brand-hub-card"
              >
                <strong>{t('brand.discovery.pagesTitle')}</strong>
                <p className="oma-muted">{t('brand.evidence.discoveryHint')}</p>
              </Link>
              <Link
                href={`/app/brands/${brandId}/discovery/products`}
                className="oma-plx-listening-card oma-plx-brand-hub-card"
              >
                <strong>{t('brand.discovery.productsTitle')}</strong>
                <p className="oma-muted">{t('brand.discovery.productsHint')}</p>
              </Link>
            </div>

            {scan ? <ScanContentOutlook brandId={brandId} brand={brand} scan={scan} /> : null}
            <BrandPipelineOutcome brandId={brandId} brand={brand} scan={scan} />
          </>
        )}
      </BrandPlxSection>
    </BrandWorkspaceShell>
  );
}
