export const FOUNDATION_CAPABILITIES = [
  'tenant.manage',
  'membership.invite',
  'membership.manage',
  'capability.assign',
  'audit.read',
  'job.read',
  'notification.read',
  'platform.tenant.create',
  'platform.support.access',
] as const;

export type CapabilityCode = (typeof FOUNDATION_CAPABILITIES)[number] | string;

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

export const SYSTEM_PROFILES: Record<string, string[]> = {
  PLATFORM_OWNER: [
    'platform.tenant.create',
    'platform.support.access',
    'tenant.manage',
    'membership.invite',
    'membership.manage',
    'capability.assign',
    'audit.read',
    'job.read',
    'notification.read',
  ],
  COMPANY_OWNER: [
    'tenant.manage',
    'membership.invite',
    'membership.manage',
    'capability.assign',
    'audit.read',
    'job.read',
    'notification.read',
  ],
  MEMBER: ['notification.read', 'job.read'],
};
