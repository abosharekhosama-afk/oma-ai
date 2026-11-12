'use client';

import Link from 'next/link';
import type { BrandDetail, ScanDetail } from '../../lib/brand-types';
import { useT } from '../../lib/use-locale';

export function ScanPipelineHandoff({
  brandId,
  brand,
  scan,
}: {
  brandId: string;
  brand: BrandDetail;
  scan: ScanDetail;
}) {
  const t = useT();
  const terminal = ['SUCCEEDED', 'PARTIAL'].includes(scan.status);
  if (!terminal) return null;

  const profileHref = scan.profile_version_id
    ? `/app/brands/${brandId}/profiles/${scan.profile_version_id}`
    : brand.latest_profile_version_id
      ? `/app/brands/${brandId}/profiles/${brand.latest_profile_version_id}`
      : `/app/brands/${brandId}/profiles`;

  const strategyHref = brand.current_approved_strategy_id
    ? `/app/brands/${brandId}/strategies/${brand.current_approved_strategy_id}`
    : `/app/brands/${brandId}/strategies/new`;

  const analysisDone = scan.analysis_status === 'ANALYZED' || scan.analysis_status === 'SKIPPED';

  return (
    <section className="oma-panel oma-stack" data-testid="scan-pipeline-handoff">
      <h2>{t('brand.scan.pipelineHandoffTitle')}</h2>
      <p className="oma-muted">{t('brand.scan.pipelineHandoffBody')}</p>
      <ol className="oma-discovery-list">
        <li>
          <Link href={`/app/brands/${brandId}/discovery/pages`} className="oma-text-link">
            {t('brand.scan.pipelineStepDiscovery')}
          </Link>
        </li>
        <li>
          <Link href={`/app/brands/${brandId}/discovery/products`} className="oma-text-link">
            {t('brand.scan.pipelineStepProducts')}
          </Link>
        </li>
        <li>
          <Link href={profileHref} className="oma-text-link">
            {analysisDone
              ? t('brand.scan.pipelineStepProfileReview')
              : t('brand.scan.pipelineStepProfileDraft')}
          </Link>
        </li>
        <li>
          <Link href={strategyHref} className="oma-text-link">
            {brand.current_approved_profile_version_id
              ? t('brand.scan.pipelineStepStrategy')
              : t('brand.scan.pipelineStepStrategyLocked')}
          </Link>
        </li>
      </ol>
    </section>
  );
}
