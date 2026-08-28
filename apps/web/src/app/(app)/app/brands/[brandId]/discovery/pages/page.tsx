'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import type {
  BrandDetail,
  DiscoveredPage,
  Paginated,
  ScanDetail,
} from '../../../../../../../lib/brand-types';
import {
  ConnectorModeChip,
  type ConnectorMode,
} from '../../../../../../../components/brand/connector-mode-banner';
import { getApiError, isPermissionDenied } from '../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { EvidenceSidePanel } from '../../../../../../../components/brand/evidence-side-panel';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../../lib/use-locale';

export default function DiscoveryPagesPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [pages, setPages] = useState<DiscoveredPage[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [connectorMode, setConnectorMode] = useState<ConnectorMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const brandRes = await api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`);
        setBrand(brandRes.data);
        const latest = brandRes.data.latest_scan?.id;
        if (!latest) {
          setLoading(false);
          return;
        }
        setScanId(latest);
        const [scanRes, pagesRes] = await Promise.all([
          api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${latest}`),
          api<Paginated<DiscoveredPage>>(`/api/v1/brands/${brandId}/scans/${latest}/pages`),
        ]);
        setConnectorMode(scanRes.data.connector_mode);
        setPages(pagesRes.data);
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
  if (loading) return <p role="status">{t('common.loading')}</p>;
  if (!brand) {
    return (
      <div className="oma-card" role="alert">
        <p style={{ color: 'var(--status-danger)' }}>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  return (
    <BrandWorkspaceShell brandId={brandId} brandName={brand.name}>
      <header className="oma-page-header">
        <div className="oma-title-row">
          <h2>{t('brand.discovery.pagesTitle')}</h2>
          <ConnectorModeChip mode={connectorMode} />
        </div>
        {scanId ? (
          <Link href={`/app/brands/${brandId}/discovery/products`}>
            {t('brand.discovery.productsTitle')}
          </Link>
        ) : null}
      </header>

      {!scanId ? (
        <div className="oma-card" role="status">
          <p>{t('brand.discovery.noScan')}</p>
          <Link href={`/app/brands/${brandId}/scans/new`} className="oma-btn">
            {t('brand.scan.start')}
          </Link>
        </div>
      ) : error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)' }}>{error}</p>
        </div>
      ) : pages.length === 0 ? (
        <div className="oma-card" role="status">
          <p>{t('brand.discovery.pagesEmpty')}</p>
        </div>
      ) : (
        <ul className="oma-discovery-list">
          {pages.map((page) => (
            <li key={page.id} className="oma-card oma-discovery-item">
              <div>
                <strong>{page.title ?? page.url}</strong>
                <span className="oma-badge oma-badge-muted">{page.classification}</span>
                <span className="oma-badge">{page.fetch_status}</span>
              </div>
              <p className="oma-muted" style={{ fontSize: 14, margin: '0.25rem 0' }}>
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="oma-ltr">
                  {page.canonical_url}
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}

      <EvidenceSidePanel
        brandId={brandId}
        evidenceId={evidenceId}
        onClose={() => setEvidenceId(null)}
      />
    </BrandWorkspaceShell>
  );
}
