export const SYSTEM_ROLES = ['SUPER_ADMIN', 'SUPPORT_SPECIALIST', 'USER'] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export function isSuperAdmin(role: SystemRole | string | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

export function isSupportStaff(role: SystemRole | string | undefined): boolean {
  return role === 'SUPER_ADMIN' || role === 'SUPPORT_SPECIALIST';
}
