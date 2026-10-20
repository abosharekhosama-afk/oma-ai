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

export const BRAND_CAPABILITIES = [
  'brand.create',
  'brand.read',
  'brand.archive',
  'brand.website.connect',
  'brand.scan.control',
  'brand.discovery.review',
  'brand.insight.edit',
  'brand.insight.decide',
  'brand.version.approve',
] as const;

export const AI_CAPABILITIES = [
  'ai.propose.brand',
  'ai.propose.strategy',
  'ai.propose.brief',
  'ai.compare',
  'ai.configure',
] as const;

export const STRATEGY_CAPABILITIES = [
  'strategy.read',
  'strategy.create',
  'strategy.edit',
  'strategy.organic.edit',
  'strategy.paid.edit',
  'strategy.evidence.link',
  'strategy.comment',
  'strategy.submit',
  'strategy.approve',
  'strategy.archive',
  'strategy.compare',
  'strategy.set_current',
] as const;


export const CAMPAIGN_CAPABILITIES = [
  'campaign.read',
  'campaign.create',
  'campaign.update',
  'campaign.archive',
] as const;

export const CONTENT_CAPABILITIES = [
  'content.read',
  'content.create',
  'content.update',
  'content.request_approval',
  'content.approve',
  'content.schedule',
  'content.archive',
] as const;

export type CapabilityCode =
  | (typeof FOUNDATION_CAPABILITIES)[number]
  | (typeof BRAND_CAPABILITIES)[number]
  | (typeof STRATEGY_CAPABILITIES)[number]
  | (typeof AI_CAPABILITIES)[number]
  | (typeof CAMPAIGN_CAPABILITIES)[number]
  | (typeof CONTENT_CAPABILITIES)[number]
  | string;

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

/** Approve package does not grant set-current (DP-003-003). */
export function approveImpliesSetCurrent(): boolean {
  return false;
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
    ...BRAND_CAPABILITIES,
    ...STRATEGY_CAPABILITIES,
    ...AI_CAPABILITIES,
  ],
  COMPANY_OWNER: [
    'tenant.manage',
    'membership.invite',
    'membership.manage',
    'capability.assign',
    'audit.read',
    'job.read',
    'notification.read',
    ...BRAND_CAPABILITIES,
    ...STRATEGY_CAPABILITIES,
    ...AI_CAPABILITIES,
  ],
  MEMBER: ['notification.read', 'job.read'],
};
