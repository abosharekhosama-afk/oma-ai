'use client';

import Link from 'next/link';
import { OmaLinkButton } from '../ui/oma-link-button';
import { useT } from '../../lib/use-locale';
import type { StrategyDetail } from '../../lib/strategy-types';
import { StatusChip } from '../ui/status-chip';
import { BrandPlxSection, BrandPlxStatGrid } from '../brand/brand-plx-section';

type Props = {
  brandId: string;
  strategyId: string;
  strategy: StrategyDetail;
};

export function StrategyOverviewSummary({ brandId, strategyId, strategy }: Props) {
  const t = useT();
  const latest = strategy.latest_version;
  if (!latest) {
    return (
      <BrandPlxSection
        title={t('strategy.overview.summaryTitle')}
        testId="strategy-overview-summary-empty"
      >
        <p className="oma-muted" role="status">
          {t('strategy.overview.noVersion')}
        </p>
        <OmaLinkButton href={`/app/brands/${brandId}/strategies/${strategyId}/edit`} type="primary">
          {t('strategy.nav.foundation')}
        </OmaLinkButton>
      </BrandPlxSection>
    );
  }

  const profileId = latest.linked_approved_profile_version_id;
  return (
    <BrandPlxSection
      title={t('strategy.overview.summaryTitle')}
      testId="strategy-overview-summary"
      actions={
        <OmaLinkButton
          href={`/app/brands/${brandId}/strategies/${strategyId}/review`}
          type="primary"
        >
          {t('strategy.nav.review')}
        </OmaLinkButton>
      }
    >
      <BrandPlxStatGrid
        stats={[
          {
            label: t('strategy.overview.versionStatus'),
            value: <StatusChip status={latest.status} />,
            hint: t('strategy.overview.versionNumber').replace(
              '{number}',
              String(latest.version_number),
            ),
          },
          {
            label: t('strategy.overview.evidenceBacked'),
            value: latest.evidence_backed ? (
              <StatusChip tone="success" label={t('strategy.overview.evidenceYes')} />
            ) : (
              <StatusChip tone="warning" label={t('strategy.overview.needsEvidence')} />
            ),
          },
          {
            label: t('strategy.overview.profileSource'),
            value: profileId ? (
              <Link href={`/app/brands/${brandId}/profiles/${profileId}`} className="oma-text-link">
                {t('brand.detail.viewProfile')}
              </Link>
            ) : (
              <span className="oma-muted">{t('strategy.overview.noProfileLink')}</span>
            ),
          },
        ]}
      />
    </BrandPlxSection>
  );
}
