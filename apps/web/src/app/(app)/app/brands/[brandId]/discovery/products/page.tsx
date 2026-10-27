'use client';
import { DetailShimmer } from '../../../../../../../components/ui/shimmer';

import { OmaLinkButton } from '../../../../../../../components/ui/oma-link-button';
import { Button } from '@oma/ui/controls';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../../../../lib/api';
import type {
  BrandDetail,
  DiscoveredProduct,
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
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [evidenceByPage, setEvidenceByPage] = useState<Record<string, string>>({});

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
        const [scanRes, productsRes, evidenceRes] = await Promise.all([
          api<{ data: ScanDetail }>(`/api/v1/brands/${brandId}/scans/${latest}`),
          api<Paginated<DiscoveredProduct>>(`/api/v1/brands/${brandId}/scans/${latest}/products`),
          api<Paginated<EvidenceItem>>(
            `/api/v1/brands/${brandId}/scans/${latest}/evidence?limit=100`,
          ),
        ]);
        setConnectorMode(scanRes.data.connector_mode);
        setProducts(productsRes.data);
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
      scanStatus={brand.latest_scan?.status}
    >
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
          <OmaLinkButton href={`/app/brands/${brandId}/scans/new`} type="primary">
            {t('brand.scan.start')}
          </OmaLinkButton>
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
          {products.map((product) => {
            const linked =
              product.source_page_id != null ? evidenceByPage[product.source_page_id] : undefined;
            return (
              <li key={product.id} className="oma-discovery-item">
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
                <div className="oma-form-actions">
                  {linked ? (
                    <Button type="default" onClick={() => setEvidenceId(linked)}>
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

      <EvidenceSidePanel
        brandId={brandId}
        evidenceId={evidenceId}
        onClose={() => setEvidenceId(null)}
      />
    </BrandWorkspaceShell>
  );
}
