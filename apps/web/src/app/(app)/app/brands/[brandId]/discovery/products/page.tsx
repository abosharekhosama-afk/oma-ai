'use client';
import { DetailShimmer } from '../../../../../../../components/ui/shimmer';

import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { Button, CheckboxField, SearchInput, SelectField } from '@oma/ui/controls';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, invalidateApiCache } from '../../../../../../../lib/api';
import type {
  BrandDetail,
  CatalogCoverageSummary,
  DiscoveredPage,
  DiscoveredProduct,
  EvidenceItem,
  Paginated,
  ProductsPage,
  ProfileDetail,
  ScanDetail,
} from '../../../../../../../lib/brand-types';
import { likelySpaShell } from '../../../../../../../lib/brand-scan-ui';
import { getApiError, isPermissionDenied } from '../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import {
  BrandPlxPageHead,
  BrandPlxStatGrid,
} from '../../../../../../../components/brand/brand-plx-section';
import { EvidenceSidePanel } from '../../../../../../../components/brand/evidence-side-panel';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../../lib/use-locale';
import { DiscoveryCatalogMergeBar } from '../../../../../../../components/brand/discovery-catalog-merge-bar';
import { DiscoveryProductCard } from '../../../../../../../components/brand/discovery-product-card';
import { DiscoveryTabs } from '../../../../../../../components/brand/discovery-tabs';
import {
  catalogStats,
  filterProducts,
  type ProductFilter,
} from '../../../../../../../lib/product-media';

const REIMPORT_POLL_MS = 6000;
const REIMPORT_POLL_TRIES = 6;
/** Safety bound: 20 pages × 100 = 2000 catalog items. */
const MAX_PRODUCT_PAGES = 20;

/** Loads every product of a scan (cursor pages of 100) plus the whole-scan coverage summary. */
async function fetchAllProducts(
  brandId: string,
  scanId: string,
  fresh = false,
): Promise<{ products: DiscoveredProduct[]; summary: CatalogCoverageSummary | null }> {
  const products: DiscoveredProduct[] = [];
  let summary: CatalogCoverageSummary | null = null;
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PRODUCT_PAGES; page++) {
    const qs = new URLSearchParams({ limit: '100' });
    if (cursor) qs.set('cursor', cursor);
    const path = `/api/v1/brands/${brandId}/scans/${scanId}/products?${qs.toString()}`;
    if (fresh) invalidateApiCache(path);
    const res: ProductsPage = await api<ProductsPage>(path);
    products.push(...res.data);
    if (page === 0) summary = res.summary ?? null;
    cursor = res.page.next_cursor;
    if (!cursor) break;
  }
  return { products, summary };
}

export default function DiscoveryProductsPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [products, setProducts] = useState<DiscoveredProduct[]>([]);
  const [coverage, setCoverage] = useState<CatalogCoverageSummary | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [evidenceByPage, setEvidenceByPage] = useState<Record<string, string>>({});
  const [spaLikely, setSpaLikely] = useState(false);
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [reimportBusy, setReimportBusy] = useState(false);
  const [reimportMessage, setReimportMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductFilter>({
    query: '',
    kind: '',
    withMediaOnly: false,
  });
  const pollTimer = useRef<number | null>(null);

  const reloadProducts = useCallback(
    async (activeScanId: string) => {
      const res = await fetchAllProducts(brandId, activeScanId, true);
      setProducts(res.products);
      setCoverage(res.summary);
      return res.products;
    },
    [brandId],
  );

  useEffect(
    () => () => {
      if (pollTimer.current) window.clearTimeout(pollTimer.current);
    },
    [],
  );

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
        const profileId = brandRes.data.latest_profile_version_id;
        const profileStatus = brandRes.data.latest_profile_status;
        const profileEditable = profileId && profileStatus && profileStatus !== 'APPROVED';
        const profilePromise = profileEditable
          ? api<{ data: ProfileDetail }>(`/api/v1/brands/${brandId}/profiles/${profileId}`)
          : Promise.resolve(null);
        const [scanRes, productsRes, evidenceRes, pagesRes, profileRes] = await Promise.all([
          api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${latest}`),
          fetchAllProducts(brandId, latest),
          api<Paginated<EvidenceItem>>(
            `/api/v1/brands/${brandId}/scans/${latest}/evidence?limit=100`,
          ),
          api<Paginated<DiscoveredPage>>(
            `/api/v1/brands/${brandId}/scans/${latest}/pages?limit=100`,
          ),
          profilePromise,
        ]);
        setScan(scanRes.data);
        setProducts(productsRes.products);
        setCoverage(productsRes.summary);
        setProfile(profileRes?.data ?? null);
        setSpaLikely(productsRes.products.length === 0 && likelySpaShell(pagesRes.data));
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
  }, [brandId]);

  const stats = useMemo(() => catalogStats(products), [products]);
  const visible = useMemo(() => filterProducts(products, filter), [products, filter]);
  const filtersActive = Boolean(filter.query.trim() || filter.kind || filter.withMediaOnly);

  async function reimport() {
    if (!scanId) return;
    setReimportBusy(true);
    setReimportMessage(null);
    setError(null);
    try {
      await api(`/api/v1/brands/${brandId}/scans/${scanId}/catalog/reimport-media`, {
        method: 'POST',
      });
      setReimportMessage(t('brand.catalog.reimportQueued'));
      const baseline = catalogStats(products).mediaTotal;
      let tries = 0;
      const poll = async () => {
        tries += 1;
        try {
          const next = await reloadProducts(scanId);
          const now = catalogStats(next).mediaTotal;
          if (now !== baseline) {
            setReimportMessage(t('brand.catalog.reimportUpdated').replace('{count}', String(now)));
            return;
          }
        } catch {
          /* transient — keep polling */
        }
        if (tries < REIMPORT_POLL_TRIES) {
          pollTimer.current = window.setTimeout(() => void poll(), REIMPORT_POLL_MS);
        } else {
          setReimportMessage(t('brand.catalog.reimportStillRunning'));
        }
      };
      pollTimer.current = window.setTimeout(() => void poll(), REIMPORT_POLL_MS);
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setReimportBusy(false);
    }
  }

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <DetailShimmer />;
  if (!brand) {
    return (
      <div className="oma-banner oma-banner-danger" role="alert">
        <p>{error ?? t('common.notFound')}</p>
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
        counts={{
          pages: scan?.discovery_summary?.pages ?? null,
          products: scanId ? products.length : null,
        }}
      />
      <BrandPlxPageHead
        title={t('brand.discovery.productsTitle')}
        description={t('brand.discovery.productsHint')}
        actions={
          scanId ? (
            <div className="oma-chip-row">
              <Button
                type="default"
                loading={reimportBusy}
                disabled={reimportBusy}
                data-testid="catalog-reimport-media"
                onClick={() => void reimport()}
              >
                {t('brand.catalog.reimportMedia')}
              </Button>
            </div>
          ) : null
        }
      />

      {reimportMessage ? (
        <p
          className="oma-plx-listening__next-check"
          role="status"
          data-testid="catalog-reimport-status"
        >
          {reimportMessage}
        </p>
      ) : null}

      {!scanId ? (
        <div className="oma-plx-listening-card oma-brand-empty" role="status">
          <p>{t('brand.discovery.noScan')}</p>
          <OmaLinkButton href={`/app/brands/${brandId}/scans/new`} type="primary">
            {t('brand.scan.start')}
          </OmaLinkButton>
        </div>
      ) : error ? (
        <div className="oma-banner oma-banner-danger" role="alert">
          <p>{error}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="oma-plx-listening-card oma-brand-empty" role="status">
          <p>{t('brand.discovery.productsEmpty')}</p>
          {spaLikely ? (
            <div className="oma-banner oma-banner-warning" data-testid="discovery-spa-hint">
              <strong>{t('brand.discovery.spaHintTitle')}</strong>
              <p>{t('brand.discovery.spaHintBody')}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <BrandPlxStatGrid
            testId="discovery-products-stats"
            stats={[
              { label: t('brand.discovery.statsProducts'), value: stats.products },
              { label: t('brand.discovery.statsServices'), value: stats.services },
              {
                label: t('brand.catalog.statsWithMedia'),
                value: `${stats.withMedia}/${stats.total}`,
                hint: t('brand.catalog.statsMediaTotal').replace(
                  '{count}',
                  String(stats.mediaTotal),
                ),
              },
              { label: t('brand.catalog.statsPendingReview'), value: stats.pendingReview },
            ]}
          />

          {coverage && coverage.total > 0 ? (
            <ul
              className="oma-discovery-coverage"
              data-testid="discovery-products-coverage"
              aria-label={t('brand.discovery.coverageTitle')}
            >
              {(
                [
                  ['coverageDescription', coverage.with_description],
                  ['coveragePrice', coverage.with_price],
                  ['coverageCategory', coverage.with_category],
                  ['coverageAvailability', coverage.with_availability],
                ] as const
              ).map(([key, value]) => (
                <li
                  key={key}
                  className={`oma-discovery-coverage__item${
                    value < coverage.total ? ' is-partial' : ''
                  }`}
                >
                  <span>{t(`brand.discovery.${key}`)}</span>
                  <strong className="oma-ltr">
                    {value}/{coverage.total}
                  </strong>
                </li>
              ))}
            </ul>
          ) : null}

          <DiscoveryCatalogMergeBar
            brandId={brandId}
            scanId={scanId ?? ''}
            products={products}
            profile={profile}
            latestProfileStatus={brand.latest_profile_status}
            onMerged={() => {
              void (async () => {
                const brandRes = await api<{ data: BrandDetail }>(`/api/v1/brands/${brandId}`);
                setBrand(brandRes.data);
                const id = brandRes.data.latest_profile_version_id;
                const status = brandRes.data.latest_profile_status;
                if (!id || !status || status === 'APPROVED') {
                  setProfile(null);
                  return;
                }
                const res = await api<{ data: ProfileDetail }>(
                  `/api/v1/brands/${brandId}/profiles/${id}`,
                );
                setProfile(res.data);
              })();
            }}
          />

          <form
            className="oma-discovery-toolbar"
            role="search"
            onSubmit={(e) => e.preventDefault()}
            aria-label={t('brand.discovery.filtersTitle')}
          >
            <label className="oma-discovery-toolbar__search">
              <span className="oma-sr-only">{t('brand.discovery.searchLabel')}</span>
              <SearchInput
                value={filter.query}
                onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
                placeholder={t('brand.discovery.productSearchPlaceholder')}
                aria-label={t('brand.discovery.searchLabel')}
                allowClear
              />
            </label>
            <div className="oma-discovery-toolbar__filters">
              <label className="oma-discovery-toolbar__field">
                <span className="oma-sr-only">{t('brand.discovery.filterKind')}</span>
                <SelectField
                  value={filter.kind}
                  aria-label={t('brand.discovery.filterKind')}
                  onChange={(e) =>
                    setFilter((f) => ({ ...f, kind: e.target.value as ProductFilter['kind'] }))
                  }
                >
                  <option value="">{t('brand.discovery.filterAllKinds')}</option>
                  <option value="PRODUCT">{t('brand.discovery.statsProducts')}</option>
                  <option value="SERVICE">{t('brand.discovery.statsServices')}</option>
                </SelectField>
              </label>
              <div className="oma-discovery-toolbar__check">
                <CheckboxField
                  checked={filter.withMediaOnly}
                  onChange={(e) => setFilter((f) => ({ ...f, withMediaOnly: e.target.checked }))}
                >
                  {t('brand.catalog.filterWithMedia')}
                </CheckboxField>
              </div>
            </div>
            <p className="oma-muted oma-discovery-toolbar__count" role="status" aria-live="polite">
              {t('brand.discovery.resultCount')
                .replace('{shown}', String(visible.length))
                .replace('{total}', String(products.length))}
            </p>
          </form>

          {visible.length === 0 ? (
            <div className="oma-plx-listening-card oma-brand-empty" role="status">
              <p>{t('brand.discovery.noMatches')}</p>
              {filtersActive ? (
                <Button
                  type="default"
                  onClick={() => setFilter({ query: '', kind: '', withMediaOnly: false })}
                >
                  {t('brand.discovery.clearFilters')}
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="oma-discovery-products-grid" data-testid="discovery-products-cards">
              {visible.map((product) => {
                const linked =
                  product.source_page_id != null
                    ? evidenceByPage[product.source_page_id]
                    : undefined;
                return (
                  <li key={product.id}>
                    <DiscoveryProductCard
                      brandId={brandId}
                      product={product}
                      profileApproved={Boolean(brand.current_approved_profile_version_id)}
                      evidenceId={linked}
                      onEvidence={() => (linked ? setEvidenceId(linked) : undefined)}
                      onUpdated={() => {
                        if (scanId) void reloadProducts(scanId);
                      }}
                    />
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
        presentation="modal"
        onClose={() => setEvidenceId(null)}
      />
    </BrandWorkspaceShell>
  );
}
