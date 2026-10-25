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

export const OPS_CAPABILITIES = [
  'request.read',
  'request.create',
  'request.update',
  'request.write',
  'request.convert',
  'task.read',
  'task.create',
  'task.update',
  'task.write',
  'task.assign',
  'task.convert',
  'deliverable.read',
  'deliverable.update',
  'deliverable.write',
  'deliverable.version.create',
  'deliverable.annotate',
  'deliverable.review',
  /**
   * Decide approve / request_changes / reject.
   * `deliverable.review` remains an equivalent grant for existing profiles.
   */
  'deliverable.review.decide',
] as const;

export type CapabilityCode =
  | (typeof FOUNDATION_CAPABILITIES)[number]
  | (typeof BRAND_CAPABILITIES)[number]
  | (typeof STRATEGY_CAPABILITIES)[number]
  | (typeof AI_CAPABILITIES)[number]
  | (typeof CAMPAIGN_CAPABILITIES)[number]
  | (typeof CONTENT_CAPABILITIES)[number]
  | (typeof OPS_CAPABILITIES)[number]
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

export function approveImpliesSetCurrent(): boolean {
  return false;
}

const CONTENT_AUTHOR = [
  'content.read',
  'content.create',
  'content.update',
  'content.request_approval',
  'content.schedule',
  'content.archive',
  'campaign.read',
  'campaign.create',
  'campaign.update',
] as const;

const CONTENT_APPROVER = [
  'content.read',
  'content.approve',
  'content.request_approval',
  'campaign.read',
  'notification.read',
] as const;

/**
 * Planable-aligned system profiles.
 * Seeded into CapabilityProfile (tenantId null) via prisma seed.
 */
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
    ...CAMPAIGN_CAPABILITIES,
    ...CONTENT_CAPABILITIES,
    ...OPS_CAPABILITIES,
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
    ...CAMPAIGN_CAPABILITIES,
    ...CONTENT_CAPABILITIES,
    ...OPS_CAPABILITIES,
  ],
  /** Planable Administrator */
  ADMIN: [
    'tenant.manage',
    'membership.invite',
    'membership.manage',
    'capability.assign',
    'audit.read',
    'job.read',
    'notification.read',
    ...BRAND_CAPABILITIES,
    ...STRATEGY_CAPABILITIES,
    ...CAMPAIGN_CAPABILITIES,
    ...CONTENT_CAPABILITIES,
    ...OPS_CAPABILITIES,
    'ai.propose.strategy',
    'ai.propose.brief',
  ],
  /** Planable Writer — create/edit content & campaigns */
  WRITER: [
    'notification.read',
    'job.read',
    'brand.read',
    'strategy.read',
    'strategy.comment',
    ...CONTENT_AUTHOR,
    ...OPS_CAPABILITIES.filter((c) => c.startsWith('request.') || c.startsWith('task.')),
    'deliverable.read',
    'deliverable.update',
    'deliverable.write',
    'deliverable.version.create',
    'deliverable.annotate',
  ],
  /** Planable Approver — approve content and deliverable review decisions */
  APPROVER: [
    ...CONTENT_APPROVER,
    'brand.read',
    'strategy.read',
    'strategy.approve',
    'request.read',
    'task.read',
    'deliverable.review',
    'deliverable.review.decide',
    'deliverable.read',
    'deliverable.annotate',
  ],
  /** Standard collaborator */
  MEMBER: [
    'notification.read',
    'job.read',
    // Least privilege: brand.* and strategy.* are NOT default for MEMBER;
    // grant them explicitly per membership (see brand/strategy security tests).
    'campaign.read',
    'content.read',
    'content.create',
    'content.update',
    'content.request_approval',
    'request.read',
    'request.create',
    'request.write',
    'task.read',
    'task.update',
    'task.write',
    'deliverable.read',
  ],
  /** External client / guest — view & approve limited */
  CLIENT: [
    'notification.read',
    'brand.read',
    'campaign.read',
    'content.read',
    'content.approve',
    'deliverable.read',
    'deliverable.review',
    'deliverable.review.decide',
    'deliverable.annotate',
  ],
  GUEST: ['notification.read', 'content.read', 'campaign.read', 'brand.read'],
  VIEWER: ['notification.read', 'content.read', 'campaign.read', 'brand.read', 'strategy.read'],
};

export const PLANABLE_ROLE_OPTIONS = [
  { role: 'Owner', profile: 'COMPANY_OWNER', kind: 'team' as const },
  { role: 'Administrator', profile: 'ADMIN', kind: 'team' as const },
  { role: 'Writer', profile: 'WRITER', kind: 'team' as const },
  { role: 'Approver', profile: 'APPROVER', kind: 'team' as const },
  { role: 'Contributor', profile: 'MEMBER', kind: 'team' as const },
  { role: 'Client', profile: 'CLIENT', kind: 'client' as const },
  { role: 'Guest', profile: 'GUEST', kind: 'client' as const },
] as const;
