export type SystemRole = 'SUPER_ADMIN' | 'SUPPORT_SPECIALIST' | 'USER';

export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'SUPER_ADMIN';
}

export function isSupportStaffRole(role?: string | null): boolean {
  return role === 'SUPER_ADMIN' || role === 'SUPPORT_SPECIALIST';
}

export function canAccessAdminHub(input: { systemRole?: string | null; capabilities?: string[] }): {
  ok: boolean;
  superAdmin: boolean;
  support: boolean;
} {
  const superAdmin = isSuperAdminRole(input.systemRole);
  const support =
    isSupportStaffRole(input.systemRole) ||
    Boolean(input.capabilities?.includes('platform.support.access'));
  return { ok: superAdmin || support, superAdmin, support };
}
