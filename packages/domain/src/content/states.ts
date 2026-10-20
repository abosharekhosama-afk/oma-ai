/** Campaign & Content domain states — production contract */

export const TRACKS = ['ORGANIC', 'PAID'] as const;
export type Track = (typeof TRACKS)[number];

export const CAMPAIGN_STATUSES = [
  'DRAFT',
  'UPCOMING',
  'ACTIVE',
  'IN_REVIEW',
  'NEEDS_ATTENTION',
  'COMPLETED',
  'ARCHIVED',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CONTENT_TYPES = ['POST', 'REEL', 'CAROUSEL', 'STATIC', 'STORY'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'SCHEDULED',
  'PUBLISHED_SAMPLE',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const APPROVAL_POLICIES = ['NONE', 'OPTIONAL', 'REQUIRED'] as const;
export type ApprovalPolicy = (typeof APPROVAL_POLICIES)[number];

export const APPROVAL_STATES = [
  'NOT_REQUESTED',
  'PENDING',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

export const SCHEDULE_STATES = ['UNSCHEDULED', 'SCHEDULED'] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

export const PUBLISH_DISPLAYS = [
  'DRAFT',
  'APPROVAL_PENDING',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'PLANNED_DATE',
  'SCHEDULED_LOCAL',
  'PUBLISHING_NOT_CONNECTED',
  'PUBLISHED_SAMPLE',
  'FAILED_SAMPLE',
] as const;
export type PublishDisplay = (typeof PUBLISH_DISPLAYS)[number];

export const CONTENT_APPROVAL_ACTIONS = [
  'REQUEST',
  'APPROVE',
  'REQUEST_CHANGES',
  'REJECT',
] as const;
export type ContentApprovalAction = (typeof CONTENT_APPROVAL_ACTIONS)[number];

export function assertTrack(value: string): asserts value is Track {
  if (!(TRACKS as readonly string[]).includes(value)) {
    throw new Error(`Invalid track: ${value}`);
  }
}

export function assertCampaignStatus(value: string): asserts value is CampaignStatus {
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid campaign status: ${value}`);
  }
}

export function assertContentStatus(value: string): asserts value is ContentStatus {
  if (!(CONTENT_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Invalid content status: ${value}`);
  }
}

export function assertApprovalPolicy(value: string): asserts value is ApprovalPolicy {
  if (!(APPROVAL_POLICIES as readonly string[]).includes(value)) {
    throw new Error(`Invalid approval policy: ${value}`);
  }
}
