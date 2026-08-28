'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import type {
  BrandDetail,
  DiscoveredProduct,
  Paginated,
  ScanDetail,
} from '../../../../../../../lib/brand-types';
import {
  ConnectorModeChip,
  type ConnectorMode,
} from '../../../../../../../components/brand/connector-mode-banner';
import { getApiError, isPermissionDenied } from '../../../../../../../lib/brand-api';
import { BrandWorkspaceShell } from '../../../../../../../components/brand/brand-workspace-shell';
import { PermissionDenied } from '../../../../../../../components/shell/permission-denied';
import { useT } from '../../../../../../../lib/use-locale';

export default function DiscoveryProductsPage() {
  const t = useT();
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [products, setProducts] = useState<DiscoveredProduct[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [connectorMode, setConnectorMode] = useState<ConnectorMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

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
        const [scanRes, productsRes] = await Promise.all([
          api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${latest}`),
          api<Paginated<DiscoveredProduct>>(`/api/v1/brands/${brandId}/scans/${latest}/products`),
        ]);
        setConnectorMode(scanRes.data.connector_mode);
        setProducts(productsRes.data);
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
          <h2>{t('brand.discovery.productsTitle')}</h2>
          <ConnectorModeChip mode={connectorMode} />
        </div>
        {scanId ? (
          <Link href={`/app/brands/${brandId}/discovery/pages`}>
            {t('brand.discovery.pagesTitle')}
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
      ) : products.length === 0 ? (
        <div className="oma-card" role="status">
          <p>{t('brand.discovery.productsEmpty')}</p>
        </div>
      ) : (
        <ul className="oma-discovery-list">
          {products.map((product) => (
            <li key={product.id} className="oma-card oma-discovery-item">
              <div>
                <strong>{product.name}</strong>
                <span className="oma-badge oma-badge-muted">{product.kind}</span>
              </div>
              {product.description ? (
                <p className="oma-muted" style={{ margin: '0.25rem 0', fontSize: 14 }}>
                  {product.description}
                </p>
              ) : null}
              <dl className="oma-detail-dl oma-detail-dl-inline">
                {product.category ? (
                  <div>
                    <dt>{t('brand.discovery.category')}</dt>
                    <dd>{product.category}</dd>
                  </div>
                ) : null}
                {product.price_amount ? (
                  <div>
                    <dt>{t('brand.discovery.price')}</dt>
                    <dd>
                      {product.price_amount} {product.price_currency}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </BrandWorkspaceShell>
  );
}
