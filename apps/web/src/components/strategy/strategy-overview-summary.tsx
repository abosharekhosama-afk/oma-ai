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
      <section className="oma-panel" data-testid="strategy-overview-summary-empty">
        <p className="oma-muted" role="status">
          {t('strategy.overview.noVersion')}
        </p>
        <OmaLinkButton href={`/app/brands/${brandId}/strategies/${strategyId}/edit`} type="primary">
          {t('strategy.nav.foundation')}
        </OmaLinkButton>
      </section>
    );
  }

  const profileId = latest.linked_approved_profile_version_id;

  return (
    <section className="oma-panel oma-stack" data-testid="strategy-overview-summary">
      <h3 className="oma-panel-title">{t('strategy.overview.summaryTitle')}</h3>
      <dl className="oma-detail-dl">
        <div>
          <dt>{t('strategy.overview.versionStatus')}</dt>
          <dd>
            <StatusChip status={latest.status} />
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
        <div>
          <dt>{t('strategy.overview.tracks')}</dt>
          <dd className="oma-strategy-tracks">
            <span
              className={
                latest.organic_enabled
                  ? 'oma-track-pill oma-track-pill--organic'
                  : 'oma-track-pill oma-track-pill--off'
              }
            >
              {t('strategy.nav.organic')}
            </span>
            <span
              className={
                latest.paid_enabled
                  ? 'oma-track-pill oma-track-pill--paid'
                  : 'oma-track-pill oma-track-pill--off'
              }
            >
              {t('strategy.nav.paid')}
            </span>
          </dd>
        </div>
      </dl>
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
    </section>
  );
}
