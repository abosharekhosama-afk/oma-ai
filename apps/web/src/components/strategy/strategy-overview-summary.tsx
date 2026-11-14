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
  const trackLabel =
    [
      latest.organic_enabled ? t('strategy.nav.organic') : null,
      latest.paid_enabled ? t('strategy.nav.paid') : null,
    ]
      .filter(Boolean)
      .join(' · ') || t('strategy.nav.paid');

  return (
    <BrandPlxSection title={t('strategy.overview.summaryTitle')} testId="strategy-overview-summary">
      <BrandPlxStatGrid
        stats={[
          {
            label: t('strategy.overview.versionStatus'),
            value: <StatusChip status={latest.status} />,
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
          {
            label: t('strategy.overview.tracks'),
            value: trackLabel,
          },
        ]}
      />
      <div className="oma-chip-row">
        <OmaLinkButton
          href={`/app/brands/${brandId}/strategies/${strategyId}/organic`}
          type="default"
        >
          {t('strategy.nav.organic')}
        </OmaLinkButton>
        <OmaLinkButton href={`/app/brands/${brandId}/strategies/${strategyId}/paid`} type="default">
          {t('strategy.nav.paid')}
        </OmaLinkButton>
        <OmaLinkButton
          href={`/app/brands/${brandId}/strategies/${strategyId}/evidence`}
          type="default"
        >
          {t('strategy.nav.evidence')}
        </OmaLinkButton>
        <OmaLinkButton
          href={`/app/brands/${brandId}/strategies/${strategyId}/review`}
          type="primary"
        >
          {t('strategy.nav.review')}
        </OmaLinkButton>
      </div>
    </BrandPlxSection>
  );
}
