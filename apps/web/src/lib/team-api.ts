import { api } from './api';

export type PlanablePerm =
  | 'view'
  | 'approve'
  | 'edit'
  | 'publish'
  | 'analyze'
  | 'engage'
  | 'admin';

export type MembershipType = 'team' | 'client';

export type WorkspaceMember = {
  id: string;
  status: string;
  invited_email?: string | null;
  accepted_at?: string | null;
  user: { id: string; email: string; name: string | null } | null;
  capabilities: string[];
  source_profiles: string[];
  /** UI-derived */
  membership?: MembershipType;
  role?: string;
  permissions?: Record<PlanablePerm, boolean>;
  last_online?: string;
};

const CAP_MAP: Record<PlanablePerm, string[]> = {
  view: ['content.read', 'content.view', 'workspace.view'],
  approve: ['review.approve', 'approval.approve', 'content.approve'],
  edit: ['content.write', 'content.edit', 'content.create'],
  publish: ['content.publish', 'schedule.publish'],
  analyze: ['analytics.read', 'analytics.view'],
  engage: ['activity.engage', 'inbox.engage', 'social.engage'],
  admin: ['membership.manage', 'membership.invite', 'capability.assign', 'tenant.admin'],
};

export function capabilitiesToPermissions(caps: string[]): Record<PlanablePerm, boolean> {
  const set = new Set(caps.map((c) => c.toLowerCase()));
  const has = (keys: string[]) => keys.some((k) => set.has(k) || [...set].some((c) => c.includes(k.split('.').pop()!)));
  return {
    view: has(CAP_MAP.view) || caps.length > 0,
    approve: has(CAP_MAP.approve),
    edit: has(CAP_MAP.edit),
    publish: has(CAP_MAP.publish),
    analyze: has(CAP_MAP.analyze),
    engage: has(CAP_MAP.engage),
    admin: has(CAP_MAP.admin),
  };
}

export function permissionsToCapabilityCodes(perms: Record<PlanablePerm, boolean>): string[] {
  const codes: string[] = [];
  (Object.keys(perms) as PlanablePerm[]).forEach((p) => {
    if (perms[p]) codes.push(...CAP_MAP[p]);
  });
  return [...new Set(codes)];
}

export function profileToRole(profiles: string[]): string {
  const p = profiles.map((x) => x.toUpperCase());
  if (p.some((x) => x.includes('OWNER'))) return 'Owner';
  if (p.some((x) => x.includes('ADMIN'))) return 'Administrator';
  if (p.some((x) => x.includes('APPROVER'))) return 'Approver';
  if (p.some((x) => x.includes('CONTRIBUTOR'))) return 'Contributor';
  if (p.some((x) => x.includes('WRITER'))) return 'Writer';
  if (p.some((x) => x.includes('GUEST'))) return 'Guest';
  if (p.some((x) => x.includes('MEMBER'))) return 'Contributor';
  return profiles[0] || 'Member';
}

export function enrichMember(m: WorkspaceMember): WorkspaceMember {
  return {
    ...m,
    role: profileToRole(m.source_profiles || []),
    membership: 'team',
    permissions: capabilitiesToPermissions(m.capabilities || []),
    last_online: m.accepted_at ? 'Active' : m.status === 'INVITED' ? 'Invited' : '—',
  };
}

export async function listWorkspaceMembers(): Promise<WorkspaceMember[]> {
  try {
    const res = await api<{ data: WorkspaceMember[] }>('/api/v1/tenants/current/members');
    return (res.data || []).map(enrichMember);
  } catch {
    const res = await api<{ data: WorkspaceMember[] }>('/api/v1/tenants/current/memberships');
    return (res.data || []).map(enrichMember);
  }
}

export async function inviteMember(input: {
  email: string;
  role?: string;
  membership?: MembershipType;
}): Promise<unknown> {
  return api('/api/v1/tenants/current/invitations', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      role: input.role,
      membership: input.membership,
    }),
  });
}

export async function removeMember(membershipId: string): Promise<unknown> {
  return api(`/api/v1/memberships/${membershipId}/remove`, { method: 'POST', body: '{}' });
}

export async function updateMemberCapabilities(
  membershipId: string,
  codes: string[],
): Promise<unknown> {
  return api(`/api/v1/memberships/${membershipId}/capabilities`, {
    method: 'POST',
    body: JSON.stringify({ codes }),
  });
}

export async function attachMemberProfile(
  membershipId: string,
  profileCode: string,
): Promise<unknown> {
  return api(`/api/v1/memberships/${membershipId}/profiles`, {
    method: 'POST',
    body: JSON.stringify({ profile_code: profileCode }),
  });
}
