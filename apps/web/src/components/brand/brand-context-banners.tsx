'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useT } from '../../lib/use-locale';
import type { ScanDetail } from '../../lib/brand-types';

export function ProfileStrategyHandoffBanner({
  brandId,
  profileVersionId,
  strategyId,
}: {
  brandId: string;
  profileVersionId: string;
  strategyId?: string | null;
}) {
  const t = useT();
  const href = strategyId
    ? `/app/brands/${brandId}/strategies/${strategyId}`
    : `/app/brands/${brandId}/strategies/new`;
  const cta = strategyId ? t('brand.detail.openStrategyCta') : t('brand.detail.createStrategyCta');

  return (
    <StatusBanner className="oma-banner oma-banner-info" testId="profile-strategy-handoff">
      <strong>{t('brand.profile.strategyHandoffTitle')}</strong>
      <p>{t('brand.profile.strategyHandoffBody')}</p>
      <div className="oma-chip-row">
        <Link href={href} className="oma-text-link" data-testid="profile-strategy-cta">
          {cta}
        </Link>
        <Link
          href={`/app/brands/${brandId}/profiles/${profileVersionId}`}
          className="oma-text-link"
        >
          {t('brand.detail.viewProfile')}
        </Link>
      </div>
    </StatusBanner>
  );
}

export function ScanCatalogHonestyBanner({
  scan,
}: {
  scan: Pick<ScanDetail, 'status' | 'coverage'>;
}) {
  const t = useT();
  if (scan.status !== 'PARTIAL') return null;
  const missing = scan.coverage?.required_missing ?? [];
  return (
    <StatusBanner className="oma-banner oma-banner-warning" testId="scan-catalog-honesty">
      <strong>{t('brand.scan.partialTitle')}</strong>
      <p>{t('brand.profile.scanPartialStrategyHint')}</p>
      {missing.length > 0 ? (
        <p className="oma-muted">
          {t('brand.coverage.requiredMissing')}: {missing.join(', ')}
        </p>
      ) : null}
    </StatusBanner>
  );
}

function StatusBanner({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className: string;
  testId: string;
}) {
  return (
    <div className={className} role="status" data-testid={testId}>
      {children}
    </div>
  );
}
