'use client';
import { DetailShimmer } from '../../../../../../components/ui/shimmer';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../../../../lib/api';
import type {
  BrandDetail,
  DiscoveredPage,
  DiscoveredProduct,
  Paginated,
  ScanDetail,
} from '../../../../../../lib/brand-types';
import { getApiError, isPermissionDenied } from '../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../components/brand/brand-workspace-shell';
import { ScanContentOutlook } from '../../../../../../components/brand/scan-content-outlook';
import {
  BrandPlxPageHead,
  BrandPlxSection,
  BrandPlxStatGrid,
} from '../../../../../../components/brand/brand-plx-section';
import { DiscoveryTabs } from '../../../../../../components/brand/discovery-tabs';
import { ConnectorModeChip } from '../../../../../../components/brand/connector-mode-banner';
import { MediaPlaceholder } from '../../../../../../components/brand/product-media-carousel';
import { OmaLinkButton } from '../../../../../../components/ui/oma-link-button';
import { StatusChip, statusLabel } from '../../../../../../components/ui/status-chip';
import { PermissionDenied } from '../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../lib/use-locale';
import { buildBrandJourneySteps } from '../../../../../../lib/brand-journey';
import { ScanRunMetaCard } from '../../../../../../components/brand/scan-run-meta-card';
import { catalogStats, productGallery } from '../../../../../../lib/product-media';

const PREVIEW_PAGES = 5;
const PREVIEW_PRODUCTS = 6;

export default function DiscoveryHubPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [pages, setPages] = useState<DiscoveredPage[]>([]);
  const [products, setProducts] = useState<DiscoveredProduct[]>([]);
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
          const [scanRes, pagesRes, productsRes] = await Promise.all([
            api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${latest}`),
            api<Paginated<DiscoveredPage>>(
              `/api/v1/brands/${brandId}/scans/${latest}/pages?limit=${PREVIEW_PAGES}`,
            ).catch(() => ({ data: [] as DiscoveredPage[] })),
            api<Paginated<DiscoveredProduct>>(
              `/api/v1/brands/${brandId}/scans/${latest}/products?limit=100`,
            ).catch(() => ({ data: [] as DiscoveredProduct[] })),
          ]);
          setScan(scanRes.data);
          setPages(pagesRes.data);
          setProducts(productsRes.data);
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
  const catalog = useMemo(() => catalogStats(products), [products]);
  const productPreview = useMemo(
    () =>
      [...products]
        .sort((a, b) => productGallery(b.media).length - productGallery(a.media).length)
        .slice(0, PREVIEW_PRODUCTS),
    [products],
  );

  if (denied) return <PermissionDenied message={t('errors.permission')} />;
  if (loading) return <DetailShimmer />;
  if (!brand) {
    return (
      <div className="oma-banner oma-banner-danger" role="alert">
        <p>{error ?? t('common.notFound')}</p>
      </div>
    );
  }

  const summary = scan?.discovery_summary;
  const base = `/app/brands/${brandId}`;
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
      <div className="oma-discovery-hub">
        <DiscoveryTabs
          brandId={brandId}
          counts={{ pages: summary?.pages ?? null, products: summary ? products.length : null }}
        />
        <BrandPlxPageHead
          title={t('brand.discovery.hubTitle')}
          description={t('brand.discovery.hubBody')}
          actions={scan ? <ConnectorModeChip mode={scan.connector_mode} /> : null}
        />

        {!brand.latest_scan ? (
          <div className="oma-plx-listening-card oma-brand-empty" role="status">
            <p>{t('brand.discovery.noScan')}</p>
            <OmaLinkButton href={`${base}/scans/new`} type="primary">
              {t('brand.scan.start')}
            </OmaLinkButton>
          </div>
        ) : (
          <>
            {error ? (
              <div className="oma-banner oma-banner-danger" role="alert">
                <p>{error}</p>
              </div>
            ) : null}
            {scan ? <ScanRunMetaCard scan={scan} /> : null}
            <BrandPlxStatGrid
              testId="discovery-summary-stats"
              stats={[
                { label: t('brand.discovery.statsPages'), value: summary?.pages ?? 0 },
                { label: t('brand.discovery.statsProducts'), value: summary?.products ?? 0 },
                { label: t('brand.discovery.statsServices'), value: summary?.services ?? 0 },
                {
                  label: t('brand.catalog.statsWithMedia'),
                  value: `${catalog.withMedia}/${catalog.total}`,
                  hint: t('brand.catalog.statsMediaTotal').replace(
                    '{count}',
                    String(catalog.mediaTotal),
                  ),
                },
              ]}
            />

            <div className="oma-discovery-preview-grid">
              <BrandPlxSection
                title={t('brand.discovery.pagesTitle')}
                description={
                  scan
                    ? t('brand.discovery.statsScanFetched')
                        .replace('{fetched}', String(scan.pages_fetched))
                        .replace(
                          '{max}',
                          String(scan.coverage?.scan_max_pages ?? scan.pages_fetched),
                        )
                    : undefined
                }
                testId="discovery-pages-preview"
                actions={
                  <Link href={`${base}/discovery/pages`} className="oma-text-link">
                    {t('brand.discovery.viewAll')}
                  </Link>
                }
              >
                {pages.length === 0 ? (
                  <p className="oma-muted" role="status">
                    {t('brand.discovery.pagesEmpty')}
                  </p>
                ) : (
                  <ul className="oma-discovery-page-list">
                    {pages.map((page) => (
                      <li key={page.id} className="oma-discovery-page-list__item">
                        <div className="oma-discovery-page-list__text">
                          <strong dir="auto">{page.title ?? page.canonical_url}</strong>
                          <span className="oma-muted oma-ltr">{page.canonical_url}</span>
                        </div>
                        <StatusChip status={page.classification} />
                      </li>
                    ))}
                  </ul>
                )}
              </BrandPlxSection>

              <BrandPlxSection
                title={t('brand.discovery.productsTitle')}
                description={t('brand.discovery.productsPreviewHint')
                  .replace('{products}', String(catalog.products))
                  .replace('{services}', String(catalog.services))}
                testId="discovery-products-preview"
                actions={
                  <Link href={`${base}/discovery/products`} className="oma-text-link">
                    {t('brand.discovery.viewAll')}
                  </Link>
                }
              >
                {productPreview.length === 0 ? (
                  <p className="oma-muted" role="status">
                    {t('brand.discovery.productsEmpty')}
                  </p>
                ) : (
                  <ul className="oma-discovery-mosaic">
                    {productPreview.map((product) => {
                      const cover = productGallery(product.media).find((m) => m.kind === 'image');
                      const count = productGallery(product.media).length;
                      return (
                        <li key={product.id}>
                          <Link
                            href={`${base}/discovery/products`}
                            className="oma-discovery-mosaic__tile"
                          >
                            <span className="oma-discovery-mosaic__media">
                              {cover ? (
                                <img src={cover.src} alt="" loading="lazy" decoding="async" />
                              ) : (
                                <MediaPlaceholder text={t('brand.catalog.noMedia')} />
                              )}
                              {count > 1 ? (
                                <span className="oma-discovery-mosaic__count">
                                  {t('brand.catalog.mediaBadge').replace('{count}', String(count))}
                                </span>
                              ) : null}
                            </span>
                            <span className="oma-discovery-mosaic__name" dir="auto">
                              {product.name}
                            </span>
                            <span className="oma-muted oma-discovery-mosaic__kind">
                              {statusLabel(t, product.kind)}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </BrandPlxSection>
            </div>

            {scan ? <ScanContentOutlook brandId={brandId} brand={brand} scan={scan} /> : null}
          </>
        )}
      </div>
    </BrandWorkspaceShell>
  );
}
