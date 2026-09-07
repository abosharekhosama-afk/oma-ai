'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import type {
  BrandDetail,
  DiscoveredPage,
  EvidenceItem,
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
  const [evidenceByPage, setEvidenceByPage] = useState<Record<string, string>>({});
  const [classification, setClassification] = useState('');
  const [fetchStatus, setFetchStatus] = useState('');

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
        const qs = new URLSearchParams();
        if (classification) qs.set('classification', classification);
        if (fetchStatus) qs.set('fetch_status', fetchStatus);
        const pagesPath = `/api/v1/brands/${brandId}/scans/${latest}/pages${
          qs.toString() ? `?${qs}` : ''
        }`;
        const [scanRes, pagesRes, evidenceRes] = await Promise.all([
          api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${latest}`),
          api<Paginated<DiscoveredPage>>(pagesPath),
          api<Paginated<EvidenceItem>>(
            `/api/v1/brands/${brandId}/scans/${latest}/evidence?limit=100`,
          ),
        ]);
        setConnectorMode(scanRes.data.connector_mode);
        setPages(pagesRes.data);
        const map: Record<string, string> = {};
        for (const item of evidenceRes.data) {
          if (item.discovered_page_id && !map[item.discovered_page_id]) {
            map[item.discovered_page_id] = item.id;
          }
        }
        setEvidenceByPage(map);
      } catch (err) {
        if (isPermissionDenied(err)) setDenied(true);
        else setError(getApiError(err).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [brandId, classification, fetchStatus]);

  const filterHint = useMemo(
    () => (classification || fetchStatus ? t('brand.discovery.filtersActive') : null),
    [classification, fetchStatus, t],
  );

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
    <BrandWorkspaceShell
      brandId={brandId}
      brandName={brand.name}
      scanStatus={brand.latest_scan?.status}
    >
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
      ) : (
        <>
          <form
            className="oma-card oma-filter-bar"
            onSubmit={(e) => e.preventDefault()}
            aria-label={t('brand.discovery.filtersTitle')}
          >
            <label className="oma-field">
              <span>{t('brand.discovery.filterClassification')}</span>
              <select
                className="oma-input"
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
              >
                <option value="">{t('brand.discovery.filterAll')}</option>
                <option value="HOME">HOME</option>
                <option value="PRODUCT">PRODUCT</option>
                <option value="ABOUT">ABOUT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </label>
            <label className="oma-field">
              <span>{t('brand.discovery.filterFetchStatus')}</span>
              <select
                className="oma-input"
                value={fetchStatus}
                onChange={(e) => setFetchStatus(e.target.value)}
              >
                <option value="">{t('brand.discovery.filterAll')}</option>
                <option value="FETCHED">FETCHED</option>
                <option value="FAILED">FAILED</option>
                <option value="SKIPPED">SKIPPED</option>
              </select>
            </label>
            {filterHint ? <p className="oma-muted">{filterHint}</p> : null}
          </form>

          {error ? (
            <div className="oma-card" role="alert">
              <p style={{ color: 'var(--status-danger)' }}>{error}</p>
            </div>
          ) : pages.length === 0 ? (
            <div className="oma-card" role="status">
              <p>{t('brand.discovery.pagesEmpty')}</p>
            </div>
          ) : (
            <ul className="oma-discovery-list">
              {pages.map((page) => {
                const linkedEvidence = evidenceByPage[page.id];
                return (
                  <li key={page.id} className="oma-card oma-discovery-item">
                    <div>
                      <strong>{page.title ?? page.url}</strong>
                      <span className="oma-badge oma-badge-muted">{page.classification}</span>
                      <span className="oma-badge">{page.fetch_status}</span>
                    </div>
                    <p className="oma-muted" style={{ fontSize: 14, margin: '0.25rem 0' }}>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="oma-ltr"
                      >
                        {page.canonical_url}
                      </a>
                    </p>
                    <div className="oma-form-actions">
                      {linkedEvidence ? (
                        <button
                          type="button"
                          className="oma-btn-secondary"
                          data-testid={`view-evidence-${page.id}`}
                          onClick={() => setEvidenceId(linkedEvidence)}
                        >
                          {t('brand.evidence.view')}
                        </button>
                      ) : (
                        <span className="oma-muted">{t('brand.evidence.none')}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <EvidenceSidePanel
        brandId={brandId}
        evidenceId={evidenceId}
        onClose={() => setEvidenceId(null)}
      />
    </BrandWorkspaceShell>
  );
}
