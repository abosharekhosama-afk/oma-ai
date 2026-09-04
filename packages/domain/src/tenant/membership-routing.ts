export type MembershipRoute =
  | { kind: 'ONBOARDING' }
  | { kind: 'AUTO_ACTIVATE'; tenantId: string }
  | { kind: 'SELECT_COMPANY' }
  | { kind: 'PROCEED'; tenantId: string };

export type ActiveMembershipRef = {
  tenantId: string;
  tenantStatus: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED' | string;
};

/**
 * Server-authoritative post-auth routing per DEC-015 Option A.
 * Only ACTIVE memberships on ACTIVE tenants qualify.
 */
export function resolveMembershipRoute(input: {
  activeMemberships: ActiveMembershipRef[];
  activeTenantId: string | null | undefined;
}): MembershipRoute {
  const qualifying = input.activeMemberships.filter((m) => m.tenantStatus === 'ACTIVE');
  const uniqueTenantIds = [...new Set(qualifying.map((m) => m.tenantId))];

  if (uniqueTenantIds.length === 0) {
    return { kind: 'ONBOARDING' };
  }

  const activeIsValid =
    !!input.activeTenantId && uniqueTenantIds.includes(input.activeTenantId);

  if (activeIsValid) {
    return { kind: 'PROCEED', tenantId: input.activeTenantId! };
  }

  if (uniqueTenantIds.length === 1) {
    return { kind: 'AUTO_ACTIVATE', tenantId: uniqueTenantIds[0]! };
  }

  return { kind: 'SELECT_COMPANY' };
}
