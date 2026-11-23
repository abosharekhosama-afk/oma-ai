'use client';

import Link from 'next/link';
import { OmaLinkButton } from '../ui/oma-link-button';
import { useT } from '../../lib/use-locale';
import type { StrategyDetail } from '../../lib/strategy-types';
import { StatusChip } from '../ui/status-chip';

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
      <div
        className="oma-strategy-summary oma-strategy-summary--empty"
        data-testid="strategy-overview-summary-empty"
      >
        <p className="oma-muted" role="status">
          {t('strategy.overview.noVersion')}
        </p>
        <OmaLinkButton href={`/app/brands/${brandId}/strategies/${strategyId}/edit`} type="primary">
          {t('strategy.nav.foundation')}
        </OmaLinkButton>
      </div>
    );
  }

  const profileId = latest.linked_approved_profile_version_id;
  return (
    <section
      className="oma-strategy-summary"
      data-testid="strategy-overview-summary"
      aria-labelledby="strategy-summary-title"
    >
      <div className="oma-strategy-summary__head">
        <h2 id="strategy-summary-title" className="oma-strategy-summary__title">
          {t('strategy.overview.summaryTitle')}
        </h2>
        <OmaLinkButton
          href={`/app/brands/${brandId}/strategies/${strategyId}/review`}
          type="default"
        >
          {t('strategy.nav.review')}
        </OmaLinkButton>
      </div>
      <dl className="oma-strategy-summary__grid">
        <div>
          <dt>{t('strategy.overview.versionStatus')}</dt>
          <dd>
            <StatusChip status={latest.status} />
            <span className="oma-muted oma-strategy-summary__meta">
              {t('strategy.overview.versionNumber').replace(
                '{number}',
                String(latest.version_number),
              )}
            </span>
          </dd>
        </div>
        <div>
          <dt>{t('strategy.overview.evidenceBacked')}</dt>
          <dd>
            {latest.evidence_backed ? (
              <StatusChip tone="success" label={t('strategy.overview.evidenceYes')} />
            ) : (
              <StatusChip tone="warning" label={t('strategy.overview.needsEvidence')} />
            )}
          </dd>
        </div>
        <div>
          <dt>{t('strategy.overview.profileSource')}</dt>
          <dd>
            {profileId ? (
              <Link href={`/app/brands/${brandId}/profiles/${profileId}`} className="oma-text-link">
                {t('brand.detail.viewProfile')}
              </Link>
            ) : (
              <span className="oma-muted">{t('strategy.overview.noProfileLink')}</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
