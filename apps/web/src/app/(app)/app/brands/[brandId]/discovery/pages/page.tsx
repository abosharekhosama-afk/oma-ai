'use client';

import { OmaTopLoader } from '../../../../../../../components/ui/oma-top-loader';
import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { Button, CheckboxField, SearchInput, SelectField } from '@oma/ui/controls';

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
import { StatusChip } from '../../../../../../../components/ui/status-chip';
import { filterDiscoveryPages } from '../../../../../../../lib/discovery-filter';
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
  const [query, setQuery] = useState('');
  const [evidenceOnly, setEvidenceOnly] = useState(false);

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

  const visiblePages = useMemo(
    () =>
      filterDiscoveryPages(pages, {
        query,
        evidenceOnly,
        evidenceByPage,
      }),
    [pages, query, evidenceOnly, evidenceByPage],
  );
  const filterHint = useMemo(
    () =>
      classification || fetchStatus || query || evidenceOnly
        ? t('brand.discovery.filtersActive')
        : null,
    [classification, fetchStatus, query, evidenceOnly, t],
  );

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <OmaTopLoader label={t('common.loading')} />;
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
          <OmaLinkButton href={`/app/brands/${brandId}/scans/new`} type="primary">
            {t('brand.scan.start')}
          </OmaLinkButton>
        </div>
      ) : (
        <>
          <form
            className="oma-filter-bar"
            onSubmit={(e) => e.preventDefault()}
            aria-label={t('brand.discovery.filtersTitle')}
          >
            <label className="oma-field">
              <span>{t('brand.discovery.searchLabel')}</span>
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('brand.discovery.searchPlaceholder')}
              />
            </label>
            <label className="oma-field">
              <span>{t('brand.discovery.filterClassification')}</span>
              <SelectField
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
              >
                <option value="">{t('brand.discovery.filterAll')}</option>
                <option value="HOME">HOME</option>
                <option value="PRODUCT">PRODUCT</option>
                <option value="ABOUT">ABOUT</option>
                <option value="OTHER">OTHER</option>
              </SelectField>
            </label>
            <label className="oma-field">
              <span>{t('brand.discovery.filterFetchStatus')}</span>
              <SelectField value={fetchStatus} onChange={(e) => setFetchStatus(e.target.value)}>
                <option value="">{t('brand.discovery.filterAll')}</option>
                <option value="FETCHED">FETCHED</option>
                <option value="FAILED">FAILED</option>
                <option value="SKIPPED">SKIPPED</option>
              </SelectField>
            </label>
            <label className="oma-checkbox-label">
              <CheckboxField
                checked={evidenceOnly}
                onChange={(e) => setEvidenceOnly(e.target.checked)}
              />{' '}
              {t('brand.discovery.evidenceAvailable')}
            </label>
            {filterHint ? (
              <div className="oma-filter-chips">
                {query ? <span className="oma-filter-chip">{query}</span> : null}
                {classification ? <span className="oma-filter-chip">{classification}</span> : null}
                {fetchStatus ? <span className="oma-filter-chip">{fetchStatus}</span> : null}
                {evidenceOnly ? (
                  <span className="oma-filter-chip">{t('brand.discovery.evidenceAvailable')}</span>
                ) : null}
                <p className="oma-muted">{filterHint}</p>
              </div>
            ) : null}
          </form>

          {error ? (
            <div className="oma-card" role="alert">
              <p style={{ color: 'var(--status-danger)' }}>{error}</p>
            </div>
          ) : visiblePages.length === 0 ? (
            <div className="oma-card" role="status">
              <p>{t('brand.discovery.pagesEmpty')}</p>
            </div>
          ) : (
            <ul className="oma-discovery-list">
              {visiblePages.map((page) => {
                const linkedEvidence = evidenceByPage[page.id];
                return (
                  <li
                    key={page.id}
                    className={
                      linkedEvidence && evidenceId === linkedEvidence
                        ? 'oma-discovery-item is-selected'
                        : 'oma-discovery-item'
                    }
                  >
                    <div className="oma-work-row" style={{ border: 0, padding: 0 }}>
                      <div>
                        <strong>{page.title ?? page.url}</strong>
                        <div className="oma-work-row-meta">
                          <StatusChip status={page.classification} />
                          <StatusChip status={page.fetch_status} />
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="oma-ltr"
                          >
                            {page.canonical_url}
                          </a>
                        </div>
                      </div>
                      {linkedEvidence ? (
                        <Button
                          type="default"
                          data-testid={`view-evidence-${page.id}`}
                          onClick={() => setEvidenceId(linkedEvidence)}
                        >
                          {t('brand.evidence.view')}
                        </Button>
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
        evidenceIds={Object.values(evidenceByPage)}
        onClose={() => setEvidenceId(null)}
        onNavigate={(id) => setEvidenceId(id)}
      />
    </BrandWorkspaceShell>
  );
}
