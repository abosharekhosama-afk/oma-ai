'use client';

import { useMemo, useState } from 'react';
import { Button } from '@oma/ui/controls';
import type { DiscoveredProduct } from '../../lib/brand-types';
import {
  availabilityKey,
  availabilityTone,
  formatProductPrice,
  productGallery,
} from '../../lib/product-media';
import { useLocale, useT } from '../../lib/use-locale';
import { StatusChip, statusLabel } from '../ui/status-chip';
import { CatalogProductActions } from './catalog-product-actions';
import { ProductMediaCarousel, ProductMediaLightbox } from './product-media-carousel';

type Props = {
  brandId: string;
  product: DiscoveredProduct;
  profileApproved: boolean;
  evidenceId?: string;
  onEvidence: () => void;
  onUpdated: () => void;
};

/** Social-post style catalog card: media carousel first, then the facts the scan captured. */
export function DiscoveryProductCard({
  brandId,
  product,
  profileApproved,
  evidenceId,
  onEvidence,
  onUpdated,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const gallery = useMemo(() => productGallery(product.media), [product.media]);
  const [viewer, setViewer] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const price = formatProductPrice(product.price_amount, product.price_currency, locale);
  const availKey = availabilityKey(product.availability);
  const availability = availKey ? t(availKey) : (product.availability?.trim() ?? null);
  const description = product.description?.trim() ?? '';
  const longDescription = description.length > 180;

  return (
    <article
      className="oma-plx-listening-card oma-discovery-product-card"
      aria-labelledby={`product-${product.id}-title`}
      data-testid={`discovery-product-${product.id}`}
    >
      <ProductMediaCarousel
        items={gallery}
        label={product.name}
        onOpen={(index) => setViewer(index)}
        testId={`product-carousel-${product.id}`}
      />

      <div className="oma-discovery-product-card__body">
        <header className="oma-discovery-product-card__head">
          <h3 id={`product-${product.id}-title`} className="oma-discovery-product-card__title">
            {product.name}
          </h3>
          <StatusChip status={product.kind} label={statusLabel(t, product.kind)} />
        </header>

        {price || availability ? (
          <div className="oma-discovery-product-card__commerce">
            {price ? (
              <strong className="oma-discovery-product-card__price" dir="auto">
                {price}
              </strong>
            ) : null}
            {availability ? (
              <StatusChip tone={availabilityTone(product.availability)} label={availability} />
            ) : null}
          </div>
        ) : null}

        {description ? (
          <div className="oma-discovery-product-card__description-wrap">
            <p
              className={`oma-discovery-product-card__description${
                longDescription && !expanded ? ' is-clamped' : ''
              }`}
              dir="auto"
            >
              {description}
            </p>
            {longDescription ? (
              <button
                type="button"
                className="oma-text-link oma-discovery-product-card__more"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? t('brand.discovery.showLess') : t('brand.discovery.showMore')}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="oma-muted oma-discovery-product-card__description">
            {t('brand.discovery.noDescription')}
          </p>
        )}

        {product.category || product.sku_public ? (
          <ul className="oma-discovery-product-card__facts">
            {product.category ? (
              <li>
                <span className="oma-muted">{t('brand.discovery.category')}</span>{' '}
                <span dir="auto">{product.category}</span>
              </li>
            ) : null}
            {product.sku_public ? (
              <li>
                <span className="oma-muted">{t('brand.discovery.sku')}</span>{' '}
                <span className="oma-ltr">{product.sku_public}</span>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <footer className="oma-discovery-product-card__foot">
        <CatalogProductActions
          brandId={brandId}
          product={product}
          profileApproved={profileApproved}
          onUpdated={onUpdated}
          compact
          trailing={
            evidenceId ? (
              <Button type="default" onClick={onEvidence}>
                {t('brand.evidence.view')}
              </Button>
            ) : null
          }
        />
      </footer>

      <ProductMediaLightbox
        items={gallery}
        index={viewer}
        caption={product.name}
        onIndexChange={setViewer}
        onClose={() => setViewer(null)}
      />
    </article>
  );
}
