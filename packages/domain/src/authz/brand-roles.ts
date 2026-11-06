/**
 * Per-brand roles. A user's effective capabilities on a brand are their workspace
 * capabilities intersected with what their brand role allows. Workspace owners/admins
 * (tenant.manage) are not limited by brand roles and see every brand.
 *
 * VIEWER is the Planable-style client/guest brand role: read by default, plus a small
 * set of collaboration caps when those were granted at the workspace (request create,
 * content comment/update, approve). Granted caps must stay effective — the role must
 * not strip them. APPROVER can leave feedback comments (content.update) in addition
 * to approve/decide caps.
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
  /** Approvers leave feedback comments on content under review. */
  'content.update',
  'strategy.approve',
  'strategy.comment',
  'deliverable.review',
  'deliverable.review.decide',
  'deliverable.annotate',
  'brand.version.approve',
  'brand.insight.decide',
]);

/**
 * Client/guest collaboration on a brand without elevating to EDITOR.
 * Only applied when the workspace already granted the capability.
 */
const VIEWER_EXTRA = new Set([
  'request.create',
  'request.update',
  'request.write',
  'request.convert',
  /** Content comments route uses content.update. Viewers cannot upload or create posts. */
  'content.update',
  'content.approve',
  'deliverable.annotate',
  'deliverable.review',
  'deliverable.review.decide',
  'strategy.comment',
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
      return isReadOnly(capability) || VIEWER_EXTRA.has(capability);
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
