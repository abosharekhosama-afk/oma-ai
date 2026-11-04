'use client';

import Link from 'next/link';
import { OmaLinkButton } from '../ui/oma-link-button';
import type { BrandListItem } from '../../lib/brand-types';
import { brandAttention, brandPrimaryHref } from '../../lib/brand-attention';
import { StatusChip } from '../ui/status-chip';
import { useT } from '../../lib/use-locale';

export function brandActionLabel(t: (key: string) => string, brand: BrandListItem): string {
  switch (brandAttention(brand)) {
    case 'connect_website':
      return t('home.action.connect') || 'Connect website';
    case 'start_scan':
      return t('home.action.scan') || 'Start scan';
    case 'review_partial':
      return t('home.action.reviewScan') || 'Review scan';
    case 'review_profile':
      return t('home.action.reviewProfile') || 'Review profile';
    case 'open_approved':
      return t('home.action.viewApproved') || 'Open workspace';
    default:
      return t('home.action.open') || 'Open';
  }
}

export function BrandMark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || 'B';
  return (
    <span className="oma-brand-mark" aria-hidden="true">
      {logoUrl ? <img className="oma-brand-logo__img" src={logoUrl} alt="" /> : initial}
    </span>
  );
}

/**
 * Production brand workspace card (Planable-style).
 * Primary CTA follows real brand lifecycle attention state.
 */
export function WorkspaceCard({ brand }: { brand: BrandListItem; compact?: boolean }) {
  const t = useT();
  const workspaceHref = `/app/brands/${brand.id}`;
  const primaryHref = brandPrimaryHref(brand);
  const website = brand.primary_website_url?.replace(/^https?:\/\//, '') || null;
  return (
    <article className="oma-workspace-card" data-testid={`workspace-card-${brand.id}`}>
      <Link href={workspaceHref} className="oma-workspace-card-main">
        <BrandMark name={brand.name} logoUrl={brand.logo_url} />
        <div className="oma-workspace-card-copy">
          <div className="oma-workspace-card__title-row">
            <h3>{brand.name}</h3>
            <StatusChip status={brand.status} />
          </div>
          <p className="oma-workspace-card-meta oma-ltr">
            {website ?? t('brand.list.noWebsite') ?? 'No website connected'}
          </p>
        </div>
      </Link>
      <dl className="oma-workspace-card__facts">
        <div>
          <dt>{t('brand.scan.historyTitle')}</dt>
          <dd>
            {brand.latest_scan_status ? <StatusChip status={brand.latest_scan_status} /> : '—'}
          </dd>
        </div>
        <div>
          <dt>{t('brand.detail.intelligenceCta')}</dt>
          <dd>
            {brand.current_approved_profile_version_id ? (
              <StatusChip tone="success" label={t('brand.versions.current') || 'Approved'} />
            ) : brand.latest_profile_status ? (
              <StatusChip status={brand.latest_profile_status} />
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>
      <div className="oma-workspace-card-actions">
        <OmaLinkButton
          href={primaryHref}
          type="primary"
          size="small"
          data-testid={`workspace-card-primary-${brand.id}`}
        >
          {brandActionLabel(t, brand)}
        </OmaLinkButton>
      </div>
    </article>
  );
}
