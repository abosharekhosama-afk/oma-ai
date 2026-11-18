import type { ApprovalPolicy } from './states';
import { resolveContentWorkflow, type WorkflowSource } from './workflow';
import { validateMediaForNetwork, type MediaAssetInfo } from '../social/media-constraints';

/**
 * Schedule readiness (DEC-023).
 *
 * "Planned" is a calendar intent (`plannedAt`) and never publishes anything.
 * "Scheduled" is a commitment to publish at `scheduledAt`, and is allowed only
 * when every blocker below is clear. The same function runs in the API
 * (schedule / enqueue / publish-now / schedule-on-approval), in read models
 * (live CANNOT_SCHEDULE display) and in the publish worker.
 */

export const SCHEDULE_BLOCKERS = [
  'ARCHIVED',
  'REJECTED',
  'APPROVAL_REQUIRED',
  'AI_REVIEW_REQUIRED',
  'NO_CONNECTED_ACCOUNT',
  'ACCOUNT_NOT_CONNECTED',
  'CHANNEL_NOT_CONNECTED',
  'MEDIA_REQUIRED',
  'MEDIA_POLICY',
] as const;
export type ScheduleBlockerCode = (typeof SCHEDULE_BLOCKERS)[number];

export type ScheduleBlocker = {
  code: ScheduleBlockerCode;
  /** Publish target / account the blocker is about, when there is one. */
  social_page_id?: string;
  network?: string;
  account_status?: string;
  /** Domain media validation issue (e.g. media_missing, reel_requires_video). */
  issue_code?: string;
};

export type ReadinessTarget = {
  socialPageId: string;
  /** Prisma enum (`INSTAGRAM`) or API code (`instagram`); compared case-insensitively. */
  network: string;
  status: string;
};

/** Networks a calendar post can be published to (WhatsApp is inbox-only). */
export const FEED_NETWORKS = ['facebook', 'instagram', 'linkedin', 'tiktok', 'x'] as const;

export type ScheduleReadinessInput = {
  workflow: WorkflowSource;
  policy: ApprovalPolicy;
  /** `ContentItem.channel` (lowercase network code for social posts). */
  channel: string;
  targets: ReadinessTarget[];
  requireConnectedAccount: boolean;
  /** AI provenance (DEC-024): AI-assisted copy needs a human review under every policy. */
  ai?: { assisted: boolean; reviewed: boolean } | null;
};

export type ScheduleReadiness = { ready: boolean; blockers: ScheduleBlocker[] };

export function scheduleRequiresConnectedAccount(
  env: { SCHEDULE_REQUIRES_CONNECTED_ACCOUNT?: string } = process.env,
): boolean {
  return (env.SCHEDULE_REQUIRES_CONNECTED_ACCOUNT ?? '').trim().toLowerCase() !== 'false';
}

const FEED_ALIASES: Record<string, string> = {
  instagram: 'instagram',
  facebook: 'facebook',
  linkedin: 'linkedin',
  tiktok: 'tiktok',
  x: 'x',
  twitter: 'x',
};

function normalizeFeedNetwork(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if ((FEED_NETWORKS as readonly string[]).includes(key)) return key;
  return FEED_ALIASES[key] ?? null;
}

/** Networks to validate before schedule / publish (targets + primary channel). */
export function publishNetworksForReadiness(channel: string, targets: ReadinessTarget[]): string[] {
  const out = new Set<string>();
  for (const t of targets) {
    const n = normalizeFeedNetwork(t.network);
    if (n) out.add(n);
  }
  for (const part of channel.split(/[,;]/)) {
    const n = normalizeFeedNetwork(part);
    if (n) out.add(n);
  }
  return [...out];
}

export function evaluateMediaScheduleBlockers(input: {
  channel: string;
  targets: ReadinessTarget[];
  contentType: string;
  media: MediaAssetInfo[];
}): ScheduleBlocker[] {
  const networks = publishNetworksForReadiness(input.channel, input.targets);
  if (!networks.length) return [];
  const blockers: ScheduleBlocker[] = [];
  for (const network of networks) {
    const issues = validateMediaForNetwork(network, input.media, {
      contentType: input.contentType,
    });
    for (const issue of issues) {
      if (issue.severity !== 'error') continue;
      blockers.push({
        code: issue.code === 'media_missing' ? 'MEDIA_REQUIRED' : 'MEDIA_POLICY',
        network,
        issue_code: issue.code,
      });
    }
  }
  return blockers;
}

export function mergeScheduleReadiness(
  base: ScheduleReadiness,
  extra: ScheduleBlocker[],
): ScheduleReadiness {
  if (!extra.length) return base;
  const blockers = [...base.blockers, ...extra];
  return { ready: base.ready && extra.length === 0, blockers };
}

export function evaluateScheduleReadiness(input: ScheduleReadinessInput): ScheduleReadiness {
  const blockers: ScheduleBlocker[] = [];
  const wf = resolveContentWorkflow(input.workflow, input.policy);
  if (wf.scheduleBlockedReason === 'ARCHIVED') blockers.push({ code: 'ARCHIVED' });
  else if (wf.scheduleBlockedReason === 'REJECTED') blockers.push({ code: 'REJECTED' });
  else if (wf.scheduleBlockedReason === 'APPROVAL_REQUIRED') {
    blockers.push({ code: 'APPROVAL_REQUIRED' });
  }

  if (input.ai?.assisted && !input.ai.reviewed) blockers.push({ code: 'AI_REVIEW_REQUIRED' });

  if (input.requireConnectedAccount) {
    const connected = input.targets.filter((t) => t.status === 'CONNECTED');
    for (const t of input.targets) {
      if (t.status !== 'CONNECTED') {
        blockers.push({
          code: 'ACCOUNT_NOT_CONNECTED',
          social_page_id: t.socialPageId,
          network: t.network.toLowerCase(),
          account_status: t.status,
        });
      }
    }
    if (connected.length === 0) {
      blockers.push({ code: 'NO_CONNECTED_ACCOUNT' });
    } else {
      const channel = input.channel.trim().toLowerCase();
      const isFeedChannel = (FEED_NETWORKS as readonly string[]).includes(channel);
      if (isFeedChannel && !connected.some((t) => t.network.toLowerCase() === channel)) {
        blockers.push({ code: 'CHANNEL_NOT_CONNECTED', network: channel });
      }
    }
  }
  return { ready: blockers.length === 0, blockers };
}

/**
 * `CHANNEL_NOT_CONNECTED` is a pre-schedule check only: once scheduled, the publish
 * targets decide where the post goes, so it is not re-evaluated afterwards.
 */
const PRE_SCHEDULE_ONLY: readonly ScheduleBlockerCode[] = ['CHANNEL_NOT_CONNECTED'];

/** Blockers that still apply to an already scheduled post (worker + CANNOT_SCHEDULE view). */
export function postScheduleBlockers(readiness: ScheduleReadiness): ScheduleBlocker[] {
  return readiness.blockers.filter((b) => !PRE_SCHEDULE_ONLY.includes(b.code));
}

/** Account connectivity blockers only (the worker evaluates approval separately). */
export function accountBlockers(readiness: ScheduleReadiness): ScheduleBlocker[] {
  return readiness.blockers.filter(
    (b) => b.code === 'NO_CONNECTED_ACCOUNT' || b.code === 'ACCOUNT_NOT_CONNECTED',
  );
}

export const CALENDAR_STATES = [
  'UNPLANNED',
  'PLANNED',
  'SCHEDULED',
  'CANNOT_SCHEDULE',
  'PUBLISHED',
] as const;
export type CalendarState = (typeof CALENDAR_STATES)[number];

/**
 * Where a post sits on the calendar. Planned and Scheduled are distinct:
 * a planned post keeps its date but nothing will publish it; a scheduled post
 * will publish at `scheduledAt` unless a blocker appears (CANNOT_SCHEDULE).
 */
export function calendarPlacement(input: {
  status: string;
  scheduleState: string;
  plannedAt: string | null;
  scheduledAt: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  readiness?: ScheduleReadiness | null;
}): { state: CalendarState; at: string | null } {
  if (input.status === 'PUBLISHED_SAMPLE' || input.publishedAt) {
    return { state: 'PUBLISHED', at: input.publishedAt ?? input.scheduledAt ?? input.plannedAt };
  }
  if (!input.archivedAt && input.scheduleState === 'SCHEDULED') {
    const blocked = input.readiness ? postScheduleBlockers(input.readiness).length > 0 : false;
    return { state: blocked ? 'CANNOT_SCHEDULE' : 'SCHEDULED', at: input.scheduledAt };
  }
  if (input.plannedAt) return { state: 'PLANNED', at: input.plannedAt };
  return { state: 'UNPLANNED', at: null };
}
