import Link from 'next/link';
import type { BrandListItem } from '../../lib/brand-types';
import { brandAttention, brandPrimaryHref } from '../../lib/brand-attention';
import { StatusChip } from '../ui/status-chip';
import { useT } from '../../lib/use-locale';

export function brandActionLabel(t: (key: string) => string, brand: BrandListItem): string {
  switch (brandAttention(brand)) {
    case 'connect_website':
      return t('home.action.connect');
    case 'start_scan':
      return t('home.action.scan');
    case 'review_partial':
      return t('home.action.reviewScan');
    case 'review_profile':
      return t('home.action.reviewProfile');
    case 'open_approved':
      return t('home.action.viewApproved');
    default:
      return t('home.action.open');
  }
}

export function BrandMark({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || 'B';
  return (
    <span className="oma-brand-mark" aria-hidden="true">
      {initial}
    </span>
  );
}

export function WorkspaceCard({ brand }: { brand: BrandListItem; compact?: boolean }) {
  const t = useT();
  const workspaceHref = `/app/brands/${brand.id}`;
  return (
    <article className="oma-workspace-card" data-testid={`workspace-card-${brand.id}`}>
      <Link href={workspaceHref} className="oma-workspace-card-main">
        <BrandMark name={brand.name} />
        <div className="oma-workspace-card-copy">
          <h3>{brand.name}</h3>
          <p className="oma-workspace-card-meta oma-ltr">
            {brand.primary_website_url ?? t('brand.list.noWebsite')}
          </p>
          <div className="oma-chip-row">
            <StatusChip status={brand.status} />
            {brand.latest_scan_status ? <StatusChip status={brand.latest_scan_status} /> : null}
            {brand.latest_profile_status ? (
              <StatusChip status={brand.latest_profile_status} />
            ) : null}
            {brand.current_approved_profile_version_id ? (
              <StatusChip tone="success" label={t('brand.versions.current')} />
            ) : null}
          </div>
        </div>
      </Link>
      <Link href={brandPrimaryHref(brand)} className="oma-btn oma-btn--sm">
        {brandActionLabel(t, brand)}
      </Link>
    </article>
  );
}
