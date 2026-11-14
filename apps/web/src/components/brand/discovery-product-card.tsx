'use client';

import { useMemo, useState } from 'react';
import { Button } from '@oma/ui/controls';
import type { DiscoveredProduct } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';
import { CatalogProductActions } from './catalog-product-actions';

type Props = {
  brandId: string;
  product: DiscoveredProduct;
  profileApproved: boolean;
  evidenceId?: string;
  onEvidence: () => void;
  onUpdated: () => void;
};

function primaryMedia(product: DiscoveredProduct) {
  const media = product.media ?? [];
  const usable = media.filter(
    (m) =>
      m.review_status !== 'REJECTED' &&
      (m.review_status === 'APPROVED' || m.role.startsWith('SCAN_')),
  );
  return (
    usable.find((m) => m.role === 'SCAN_THUMBNAIL') ??
    usable.find((m) => m.mime.startsWith('image/')) ??
    usable.find((m) => m.mime.startsWith('video/')) ??
    null
  );
}

export function DiscoveryProductCard({
  brandId,
  product,
  profileApproved,
  evidenceId,
  onEvidence,
  onUpdated,
}: Props) {
  const t = useT();
  const [zoomOpen, setZoomOpen] = useState(false);
  const hero = useMemo(() => primaryMedia(product), [product]);

  return (
    <article className="oma-plx-listening-card oma-plx-brand-catalog-card oma-discovery-product-card">
      <header className="oma-discovery-product-card__head">
        <h3 className="oma-discovery-product-card__title">{product.name}</h3>
        <span className="oma-badge oma-badge-muted">{product.kind}</span>
      </header>

      {hero ? (
        <button
          type="button"
          className="oma-discovery-product-card__hero"
          onClick={() => setZoomOpen(true)}
          aria-label={t('brand.catalog.zoomImage')}
        >
          {hero.mime.startsWith('video/') ? (
            <video
              src={hero.stream_url ?? hero.view_url}
              playsInline
              muted
              className="oma-discovery-product-card__hero-media"
            />
          ) : (
            <img
              src={hero.view_url}
              alt=""
              className="oma-discovery-product-card__hero-media"
              loading="lazy"
            />
          )}
          <span className="oma-discovery-product-card__zoom-hint">
            {t('brand.catalog.tapToZoom')}
          </span>
        </button>
      ) : (
        <p className="oma-muted oma-discovery-product-card__no-media">
          {t('brand.catalog.noMedia')}
        </p>
      )}

      {product.description ? (
        <p className="oma-discovery-product-card__description">{product.description}</p>
      ) : (
        <p className="oma-muted oma-discovery-product-card__description">
          {t('brand.discovery.noDescription')}
        </p>
      )}

      <dl className="oma-detail-dl oma-discovery-product-card__meta">
        {product.category ? (
          <div>
            <dt>{t('brand.discovery.category')}</dt>
            <dd>{product.category}</dd>
          </div>
        ) : null}
        {product.sku_public ? (
          <div>
            <dt>{t('brand.discovery.sku')}</dt>
            <dd>{product.sku_public}</dd>
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
        {product.availability ? (
          <div>
            <dt>{t('brand.discovery.availability')}</dt>
            <dd>{product.availability}</dd>
          </div>
        ) : null}
      </dl>

      <CatalogProductActions
        brandId={brandId}
        product={product}
        profileApproved={profileApproved}
        onUpdated={onUpdated}
        compact
      />

      <div className="oma-form-actions">
        {evidenceId ? (
          <Button type="default" onClick={onEvidence}>
            {t('brand.evidence.view')}
          </Button>
        ) : (
          <span className="oma-muted">{t('brand.evidence.none')}</span>
        )}
      </div>

      {zoomOpen && hero && !hero.mime.startsWith('video/') ? (
        <dialog
          open
          className="oma-catalog-lightbox"
          data-testid="catalog-image-lightbox"
          onClick={() => setZoomOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setZoomOpen(false)}
        >
          <img src={hero.view_url} alt="" className="oma-catalog-lightbox__img" />
          <p className="oma-catalog-lightbox__caption">{product.name}</p>
        </dialog>
      ) : null}
    </article>
  );
}
