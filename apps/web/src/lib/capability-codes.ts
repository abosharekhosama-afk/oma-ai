/** Mirrors domain SYSTEM_PROFILES labels for UI (no server import). */

export function hasCapability(
  grants: readonly string[],
  required: string | string[],
  mode: 'any' | 'all' = 'all',
): boolean {
  const needed = Array.isArray(required) ? required : [required];
  if (needed.length === 0) return true;
  const set = new Set(grants);
  return mode === 'any' ? needed.some((c) => set.has(c)) : needed.every((c) => set.has(c));
}

export const PLANABLE_ROLES = [
  { role: 'Owner', profile: 'COMPANY_OWNER', kind: 'team' as const, desc: 'Full ownership of the company workspace' },
  { role: 'Administrator', profile: 'ADMIN', kind: 'team' as const, desc: 'Manage people, brands, and settings' },
  { role: 'Writer', profile: 'WRITER', kind: 'team' as const, desc: 'Create and edit posts and campaigns' },
  { role: 'Approver', profile: 'APPROVER', kind: 'team' as const, desc: 'Review and approve content' },
  { role: 'Contributor', profile: 'MEMBER', kind: 'team' as const, desc: 'Collaborate on content and requests' },
  { role: 'Client', profile: 'CLIENT', kind: 'client' as const, desc: 'External client — view and approve' },
  { role: 'Guest', profile: 'GUEST', kind: 'client' as const, desc: 'Limited view access' },
] as const;

export const CAPABILITY_LABELS: Record<string, string> = {
  'content.approve': 'Approve posts',
  'content.schedule': 'Schedule posts',
  'content.create': 'Create posts',
  'membership.invite': 'Invite people',
  'membership.manage': 'Manage people',
  'tenant.manage': 'Manage company',
  'capability.assign': 'Assign roles',
};
