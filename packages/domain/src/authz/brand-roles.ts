/**
 * Per-brand roles. A user's effective capabilities on a brand are their workspace
 * capabilities intersected with what their brand role allows. Workspace owners/admins
 * (tenant.manage) are not limited by brand roles and see every brand.
 */
export const BRAND_MEMBER_ROLES = ['MANAGER', 'EDITOR', 'APPROVER', 'VIEWER'] as const;
export type BrandMemberRole = (typeof BRAND_MEMBER_ROLES)[number];

/** Managing the brand itself: settings, archive, members, social accounts. */
export const BRAND_MANAGER_ONLY = new Set([
  'brand.create',
  'brand.archive',
  'brand.website.connect',
  'membership.manage',
  'membership.invite',
  'capability.assign',
]);

const APPROVER_EXTRA = new Set([
  'content.approve',
  'strategy.approve',
  'strategy.comment',
  'deliverable.review',
  'deliverable.review.decide',
  'deliverable.annotate',
  'brand.version.approve',
  'brand.insight.decide',
]);

function isReadOnly(code: string) {
  return code.endsWith('.read') || code === 'strategy.compare';
}

export function brandRoleAllows(role: BrandMemberRole, capability: string): boolean {
  switch (role) {
    case 'MANAGER':
      return true;
    case 'EDITOR':
      return !BRAND_MANAGER_ONLY.has(capability);
    case 'APPROVER':
      return isReadOnly(capability) || APPROVER_EXTRA.has(capability);
    case 'VIEWER':
      return isReadOnly(capability);
  }
}

export function capabilitiesForBrandRole(
  workspaceCapabilities: readonly string[],
  role: BrandMemberRole,
): string[] {
  return workspaceCapabilities.filter((c) => brandRoleAllows(role, c));
}

export function isBrandMemberRole(v: unknown): v is BrandMemberRole {
  return typeof v === 'string' && (BRAND_MEMBER_ROLES as readonly string[]).includes(v);
}
