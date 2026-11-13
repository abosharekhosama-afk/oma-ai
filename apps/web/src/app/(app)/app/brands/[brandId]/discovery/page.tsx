'use client';
import { DetailShimmer } from '../../../../../../components/ui/shimmer';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type { BrandDetail, ScanDetail } from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { BrandPipelineOutcome } from '../../../../../../components/brand/brand-pipeline-outcome';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../lib/use-locale';

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
      scanStatus={brand.latest_scan?.status}
    >
      <header className="oma-page-header">
        <h2>{t('brand.discovery.hubTitle')}</h2>
        <p className="oma-muted">{t('brand.discovery.hubBody')}</p>
      </header>

      {!brand.latest_scan ? (
        <p role="status">{t('brand.discovery.noScan')}</p>
      ) : (
        <>
          <dl className="oma-detail-dl oma-panel" data-testid="discovery-summary-stats">
            <div>
              <dt>{t('brand.discovery.statsPages')}</dt>
              <dd>{summary?.pages ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('brand.discovery.statsProducts')}</dt>
              <dd>{summary?.products ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('brand.discovery.statsServices')}</dt>
              <dd>{summary?.services ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('brand.discovery.statsScanPages')}</dt>
              <dd>
                {scan
                  ? t('brand.discovery.statsScanFetched')
                      .replace('{fetched}', String(scan.pages_fetched))
                      .replace('{max}', String(scan.coverage?.scan_max_pages ?? scan.pages_fetched))
                  : '—'}
              </dd>
            </div>
          </dl>

          <div className="oma-chip-row">
            <Link href={`/app/brands/${brandId}/discovery/pages`} className="oma-text-link">
              {t('brand.discovery.pagesTitle')}
            </Link>
            <Link href={`/app/brands/${brandId}/discovery/products`} className="oma-text-link">
              {t('brand.discovery.productsTitle')}
            </Link>
          </div>

          <BrandPipelineOutcome brandId={brandId} brand={brand} scan={scan} />
        </>
      )}
    </BrandWorkspaceShell>
  );
}
