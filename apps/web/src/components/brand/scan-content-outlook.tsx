'use client';

import Link from 'next/link';
import type { BrandDetail, ScanDetail } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';
import { BrandPlxSection, BrandPlxStatGrid } from './brand-plx-section';

type Props = {
  brandId: string;
  brand: BrandDetail;
  scan: ScanDetail;
};

/** What the scanned catalog can turn into (counts come from the scan's content_outlook). */
export function ScanContentOutlook({ brandId, brand, scan }: Props) {
  const t = useT();
  const outlook = scan.content_outlook;
  if (!outlook || outlook.catalog_items === 0) return null;

  const strategyHref = brand.current_approved_strategy_id
    ? `/app/brands/${brandId}/strategies/${brand.current_approved_strategy_id}/review`
    : brand.current_approved_profile_version_id
      ? `/app/brands/${brandId}/strategies/new`
      : `/app/brands/${brandId}/profiles`;

  const names = [...outlook.product_names, ...outlook.service_names];

  return (
    <BrandPlxSection
      title={t('brand.scan.contentOutlookTitle')}
      description={t('brand.scan.contentOutlookBody')}
      testId="scan-content-outlook"
      actions={
        <Link href={strategyHref} className="oma-text-link">
          {t('brand.scan.contentNextStrategy')}
        </Link>
      }
    >
      <BrandPlxStatGrid
        stats={[
          { label: t('brand.scan.contentCatalogCount'), value: outlook.catalog_items },
          {
            label: t('brand.scan.contentOrganicEstimate'),
            value: outlook.estimated_organic_requests,
          },
          { label: t('brand.scan.contentPaidEstimate'), value: outlook.estimated_paid_requests },
        ]}
      />
      {names.length > 0 ? (
        <div>
          <h4 className="oma-brand-subheading">{t('brand.scan.contentProductSample')}</h4>
          <ul className="oma-brand-tag-list">
            {names.map((name) => (
              <li key={name} dir="auto">
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </BrandPlxSection>
  );
}
