import { api } from './api';

export type PlanablePerm = 'view' | 'approve' | 'edit' | 'publish' | 'analyze' | 'engage' | 'admin';

export type MembershipType = 'team' | 'client';

export type WorkspaceMember = {
  id: string;
  status: string;
  invited_email?: string | null;
  accepted_at?: string | null;
  membership_kind?: string | null;
  display_role?: string | null;
  user: { id: string; email: string; name: string | null } | null;
  capabilities: string[];
  source_profiles: string[];
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
  const has = (keys: string[]) =>
    keys.some((k) => set.has(k) || [...set].some((c) => c.includes(k.split('.').pop()!)));
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

export function profileToRole(profiles: string[], displayRole?: string | null): string {
  if (displayRole) return displayRole;
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
    role: profileToRole(m.source_profiles || [], m.display_role),
    membership: (m.membership_kind === 'client' ? 'client' : 'team') as MembershipType,
    permissions: capabilitiesToPermissions(m.capabilities || []),
    last_online: m.accepted_at ? 'Active' : m.status === 'INVITED' ? 'Invited' : '—',
  };
}

/** In-flight + short TTL cache — prevents StrictMode double mount + multi-page storms. */
let cache: { at: number; data: WorkspaceMember[] } | null = null;
let inflight: Promise<WorkspaceMember[]> | null = null;
const CACHE_MS = 15_000;

export function invalidateMembersCache() {
  cache = null;
  inflight = null;
}

export async function listWorkspaceMembers(opts?: { force?: boolean }): Promise<WorkspaceMember[]> {
  if (!opts?.force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.data;
  }
  if (!opts?.force && inflight) {
    return inflight;
  }

  inflight = (async () => {
    // Single endpoint only — do NOT fan-out to /members then /memberships (doubles rate-limit hits).
    // Prefer the open read endpoint; fall back only on 403/404, never on 429.
    let res: { data: WorkspaceMember[] };
    try {
      res = await api<{ data: WorkspaceMember[] }>('/api/v1/tenants/current/members');
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 429) {
        // Surface rate limit; do not issue a second request.
        throw err;
      }
      if (status === 403 || status === 404) {
        res = await api<{ data: WorkspaceMember[] }>('/api/v1/tenants/current/memberships');
      } else {
        throw err;
      }
    }
    const data = (res.data || []).map(enrichMember);
    cache = { at: Date.now(), data };
    return data;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export async function inviteMember(input: {
  email: string;
  role?: string;
  membership?: MembershipType;
}): Promise<unknown> {
  invalidateMembersCache();
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
  invalidateMembersCache();
  return api(`/api/v1/memberships/${membershipId}/remove`, { method: 'POST', body: '{}' });
}

export async function updateMemberCapabilities(
  membershipId: string,
  codes: string[],
): Promise<unknown> {
  invalidateMembersCache();
  return api(`/api/v1/memberships/${membershipId}/capabilities`, {
    method: 'POST',
    body: JSON.stringify({ codes }),
  });
}

export async function attachMemberProfile(
  membershipId: string,
  profileCode: string,
): Promise<unknown> {
  invalidateMembersCache();
  return api(`/api/v1/memberships/${membershipId}/profiles`, {
    method: 'POST',
    body: JSON.stringify({ profile_code: profileCode }),
  });
}
