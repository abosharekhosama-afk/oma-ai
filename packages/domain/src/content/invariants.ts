import { DomainError } from '../errors';

export function assertSameTenant(parts: { tenantId: string }[]): void {
  if (parts.length === 0) return;
  const t = parts[0]!.tenantId;
  for (const p of parts) {
    if (p.tenantId !== t) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Tenant mismatch across related entities',
        400,
        'error.tenant_mismatch',
      );
    }
  }
}

export function assertContentBelongsToCampaignBrand(input: {
  contentBrandId: string;
  campaignBrandId: string;
}): void {
  if (input.contentBrandId !== input.campaignBrandId) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Content brand must match campaign brand',
      400,
      'error.content_campaign_brand_mismatch',
    );
  }
}

export function assertBrandNotArchived(archivedAt: Date | string | null | undefined): void {
  if (archivedAt) {
    throw new DomainError(
      'BRAND_ARCHIVED',
      'Brand is archived',
      409,
      'error.brand_archived',
    );
  }
}

export function assertValidTimeline(start: Date | string, end: Date | string): void {
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Invalid campaign timeline',
      400,
      'error.invalid_timeline',
    );
  }
}
