'use client';

import Link from 'next/link';
import { OmaLinkButton } from '../ui/oma-link-button';
import { StatusChip, statusLabel } from '../ui/status-chip';
import { formatBrandDateTime } from '../../lib/brand-format';
import { useLocale, useT } from '../../lib/use-locale';

export type ProfileVersionCardModel = {
  id: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  scan_attempt_id: string | null;
  ai_availability: string;
  analysis_status?: string | null;
  scan_status?: string | null;
  scan_finished_at?: string | null;
};

export function ProfileVersionCard({
  brandId,
  version,
  isApprovedCurrent,
  approvedProfileId,
}: {
  brandId: string;
  version: ProfileVersionCardModel;
  isApprovedCurrent: boolean;
  approvedProfileId: string | null | undefined;
}) {
  const t = useT();
  const locale = useLocale();
  const profileHref = `/app/brands/${brandId}/profiles/${version.id}`;
  const scanHref = version.scan_attempt_id
    ? `/app/brands/${brandId}/scans/${version.scan_attempt_id}`
    : null;

  const aiLabel =
    version.ai_availability === 'AVAILABLE' || version.ai_availability === 'USED'
      ? t('brand.versions.aiUsed')
      : version.ai_availability === 'SKIPPED'
        ? t('brand.versions.aiReady')
        : t('brand.versions.aiUnavailable');

  return (
    <li className="oma-plx-listening-card oma-profile-version-card" data-testid="profile-version-card">
      <header className="oma-profile-version-card__head">
        <div className="oma-profile-version-card__title-row">
          <Link href={profileHref} className="oma-profile-version-card__title">
            {formatBrandDateTime(version.created_at, locale)}
          </Link>
          <div className="oma-profile-version-card__chips">
            <StatusChip status={version.status} />
            {isApprovedCurrent ? (
              <StatusChip tone="success" label={t('brand.versions.current')} />
            ) : null}
          </div>
        </div>
        <p className="oma-muted oma-profile-version-card__id">{version.id}</p>
      </header>

      <dl className="oma-profile-version-card__facts">
        <div>
          <dt>{t('brand.versions.created')}</dt>
          <dd>{formatBrandDateTime(version.created_at, locale)}</dd>
        </div>
        {version.approved_at ? (
          <div>
            <dt>{t('brand.versions.approved')}</dt>
            <dd>{formatBrandDateTime(version.approved_at, locale)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{t('brand.versions.analysis')}</dt>
          <dd>
            {version.analysis_status
              ? statusLabel(t, version.analysis_status)
              : t('brand.versions.analysisNotRun')}
          </dd>
        </div>
        <div>
          <dt>{t('brand.versions.aiStatus')}</dt>
          <dd>{aiLabel}</dd>
        </div>
        {version.scan_status ? (
          <div>
            <dt>{t('brand.versions.sourceScan')}</dt>
            <dd>{statusLabel(t, version.scan_status)}</dd>
          </div>
        ) : null}
        {version.scan_finished_at ? (
          <div>
            <dt>{t('brand.versions.scanFinished')}</dt>
            <dd>{formatBrandDateTime(version.scan_finished_at, locale)}</dd>
          </div>
        ) : null}
      </dl>

      <footer className="oma-profile-version-card__actions">
        <OmaLinkButton href={profileHref} type="primary">
          {version.status === 'APPROVED'
            ? t('brand.detail.viewProfile')
            : t('brand.intelligence.reviewDraft')}
        </OmaLinkButton>
        {scanHref ? (
          <Link href={scanHref} className="oma-text-link">
            {t('brand.versions.openScan')}
          </Link>
        ) : null}
        {approvedProfileId && version.id !== approvedProfileId ? (
          <Link
            href={`${profileHref}/compare`}
            className="oma-text-link"
          >
            {t('brand.profile.compare')}
          </Link>
        ) : null}
      </footer>
    </li>
  );
}