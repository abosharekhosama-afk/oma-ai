'use client';
import { DetailShimmer } from '../../../../../../../components/ui/shimmer';

import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { CheckboxField, SearchInput, SelectField } from '@oma/ui/controls';

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
import { getApiError, isPermissionDenied } from '../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { BrandPlxPageHead } from '../../../../../../../components/brand/brand-plx-section';
import { EvidenceSidePanel } from '../../../../../../../components/brand/evidence-side-panel';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { statusLabel } from '../../../../../../../components/ui/status-chip';
import { DiscoveryTabs } from '../../../../../../../components/brand/discovery-tabs';
import { DiscoveryPageCard } from '../../../../../../../components/brand/discovery-page-card';
import { filterDiscoveryPages } from '../../../../../../../lib/discovery-filter';
import { useT } from '../../../../../../../lib/use-locale';

/** Mirrors Prisma `PageClassification` / `PageFetchStatus` — the API filters on these exact values. */
const PAGE_CLASSIFICATIONS = [
  'HOME',
  'PRODUCT',
  'COLLECTION',
  'SERVICE',
  'ABOUT',
  'FAQ',
  'CONTACT',
  'LEGAL',
  'OTHER',
  'UNKNOWN',
] as const;
const PAGE_FETCH_STATUSES = ['FETCHED', 'FAILED', 'SKIPPED_ROBOTS', 'SKIPPED_LIMIT'] as const;

export default function DiscoveryPagesPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [pages, setPages] = useState<DiscoveredPage[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ScanDetail['discovery_summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [evidenceByPage, setEvidenceByPage] = useState<Record<string, string>>({});
  const [classification, setClassification] = useState('');
  const [fetchStatus, setFetchStatus] = useState('');
  const [query, setQuery] = useState('');
  const [evidenceOnly, setEvidenceOnly] = useState(false);
  const [hideSeedProbes, setHideSeedProbes] = useState(true);

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
        qs.set('limit', '200');
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
        setSummary(scanRes.data.discovery_summary ?? null);
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
        hideSeedProbes,
      }),
    [pages, query, evidenceOnly, evidenceByPage, hideSeedProbes],
  );
  const filterHint = useMemo(
    () =>
      classification || fetchStatus || query || evidenceOnly
        ? t('brand.discovery.filtersActive')
        : null,
    [classification, fetchStatus, query, evidenceOnly, t],
  );

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <DetailShimmer />;
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
      brandLogoUrl={brand.logo_url}
      websiteUrl={brand.website?.normalized_url}
      scanStatus={brand.latest_scan?.status}
      latestScanId={brand.latest_scan?.id}
    >
      <DiscoveryTabs
        brandId={brandId}
        counts={{ pages: summary?.pages ?? null, products: summary?.products ?? null }}
      />
      <BrandPlxPageHead
        title={t('brand.discovery.pagesTitle')}
        description={t('brand.evidence.discoveryHint')}
      />

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
            className="oma-filter-bar oma-filter-bar--discovery"
            onSubmit={(e) => e.preventDefault()}
            aria-label={t('brand.discovery.filtersTitle')}
          >
            <label className="oma-field oma-filter-bar__search">
              <span>{t('brand.discovery.searchLabel')}</span>
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('brand.discovery.searchPlaceholder')}
              />
            </label>
            <div className="oma-filter-bar__row">
              <label className="oma-field oma-filter-bar__grow">
                <span>{t('brand.discovery.filterClassification')}</span>
                <SelectField
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                >
                  <option value="">{t('brand.discovery.filterAll')}</option>
                  {PAGE_CLASSIFICATIONS.map((value) => (
                    <option key={value} value={value}>
                      {statusLabel(t, value)}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className="oma-field oma-filter-bar__grow">
                <span>{t('brand.discovery.filterFetchStatus')}</span>
                <SelectField value={fetchStatus} onChange={(e) => setFetchStatus(e.target.value)}>
                  <option value="">{t('brand.discovery.filterAll')}</option>
                  {PAGE_FETCH_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {statusLabel(t, value)}
                    </option>
                  ))}
                </SelectField>
              </label>
            </div>
            <div className="oma-filter-bar__checks">
              <label className="oma-checkbox-label oma-checkbox-label--inline">
                <CheckboxField
                  checked={evidenceOnly}
                  onChange={(e) => setEvidenceOnly(e.target.checked)}
                />{' '}
                {t('brand.discovery.evidenceAvailable')}
              </label>
              <label className="oma-checkbox-label oma-checkbox-label--inline">
                <CheckboxField
                  checked={hideSeedProbes}
                  onChange={(e) => setHideSeedProbes(e.target.checked)}
                />{' '}
                {t('brand.discovery.hideSeedProbes')}
              </label>
            </div>
            {filterHint ? (
              <div className="oma-filter-chips">
                {query ? <span className="oma-filter-chip">{query}</span> : null}
                {classification ? (
                  <span className="oma-filter-chip">{statusLabel(t, classification)}</span>
                ) : null}
                {fetchStatus ? (
                  <span className="oma-filter-chip">{statusLabel(t, fetchStatus)}</span>
                ) : null}
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
            <ul
              className="oma-plx-brand-data-grid oma-discovery-pages-grid"
              data-testid="discovery-pages-cards"
            >
              {visiblePages.map((page) => (
                <DiscoveryPageCard
                  key={page.id}
                  page={page}
                  evidenceId={evidenceByPage[page.id]}
                  onViewEvidence={
                    evidenceByPage[page.id]
                      ? () => setEvidenceId(evidenceByPage[page.id]!)
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </>
      )}

      <EvidenceSidePanel
        brandId={brandId}
        evidenceId={evidenceId}
        evidenceIds={Object.values(evidenceByPage)}
        presentation="modal"
        onClose={() => setEvidenceId(null)}
        onNavigate={(id) => setEvidenceId(id)}
      />
    </BrandWorkspaceShell>
  );
}
