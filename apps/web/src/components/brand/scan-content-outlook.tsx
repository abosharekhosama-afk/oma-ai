'use client';

import Link from 'next/link';
import type { BrandDetail, ScanDetail } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';

type Props = {
  brandId: string;
  brand: BrandDetail;
  scan: ScanDetail;
};

export function ScanContentOutlook({ brandId, brand, scan }: Props) {
  const t = useT();
  const outlook = scan.content_outlook;
  if (!outlook || outlook.catalog_items === 0) return null;

  const strategyHref = brand.current_approved_strategy_id
    ? `/app/brands/${brandId}/strategies/${brand.current_approved_strategy_id}/review`
    : brand.current_approved_profile_version_id
      ? `/app/brands/${brandId}/strategies/new`
      : `/app/brands/${brandId}/profiles`;

  return (
    <section className="oma-panel oma-stack" data-testid="scan-content-outlook">
      <h2>{t('brand.scan.contentOutlookTitle')}</h2>
      <p className="oma-muted">{t('brand.scan.contentOutlookBody')}</p>
      <dl className="oma-detail-dl">
        <div>
          <dt>{t('brand.scan.contentCatalogCount')}</dt>
          <dd>{outlook.catalog_items}</dd>
        </div>
        <div>
          <dt>{t('brand.scan.contentRequestEstimate')}</dt>
          <dd>
            {t('brand.scan.contentRequestEstimateDetail')
              .replace('{organic}', String(outlook.estimated_organic_requests))
              .replace('{paid}', String(outlook.estimated_paid_requests))}
          </dd>
        </div>
      </dl>
      {outlook.product_names.length > 0 ? (
        <div>
          <h3 className="oma-h4">{t('brand.scan.contentProductSample')}</h3>
          <ul className="oma-list-compact">
            {outlook.product_names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p>
        <Link href={`/app/brands/${brandId}/discovery/products`} className="oma-text-link">
          {t('brand.scan.contentReviewDiscovery')}
        </Link>
        {' · '}
        <Link href={strategyHref} className="oma-text-link">
          {t('brand.scan.contentNextStrategy')}
        </Link>
      </p>
    </section>
  );
}