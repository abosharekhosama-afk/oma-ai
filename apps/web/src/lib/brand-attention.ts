import type { BrandListItem } from './brand-types';

export type BrandAttention =
  | 'connect_website'
  | 'start_scan'
  | 'review_partial'
  | 'review_profile'
  | 'open_approved'
  | 'open_brand';

export function brandAttention(brand: BrandListItem): BrandAttention {
  if (!brand.primary_website_url) return 'connect_website';
  if (!brand.latest_scan_status) return 'start_scan';
  if (brand.latest_scan_status === 'PARTIAL' || brand.latest_scan_status === 'FAILED') {
    return 'review_partial';
  }
  if (brand.latest_profile_status === 'DRAFT' || brand.latest_profile_status === 'NEEDS_REVIEW') {
    return 'review_profile';
  }
  if (brand.current_approved_profile_version_id) return 'open_approved';
  return 'open_brand';
}

export function brandPrimaryHref(brand: BrandListItem): string {
  switch (brandAttention(brand)) {
    case 'connect_website':
      return `/app/brands/${brand.id}/connect`;
    case 'start_scan':
      return `/app/brands/${brand.id}/scans/new`;
    case 'review_partial':
      return brand.latest_scan_id
        ? `/app/brands/${brand.id}/scans/${brand.latest_scan_id}`
        : `/app/brands/${brand.id}`;
    case 'review_profile':
      return brand.latest_profile_version_id
        ? `/app/brands/${brand.id}/profiles/${brand.latest_profile_version_id}`
        : `/app/brands/${brand.id}/profiles`;
    case 'open_approved':
      return `/app/brands/${brand.id}/profiles/${brand.current_approved_profile_version_id}`;
    default:
      return `/app/brands/${brand.id}`;
  }
}

export function isBrandNeedingAction(brand: BrandListItem): boolean {
  const attention = brandAttention(brand);
  return attention !== 'open_approved' && attention !== 'open_brand';
}
