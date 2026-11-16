import { briefFieldsFromDescription } from './brief-readiness';
import {
  briefContentSchema,
  briefSubmitReadiness,
  type BriefContent,
  type BriefStatus,
} from './brief-entity';

/**
 * Legacy request → Brief backfill (DEC-019 §7).
 *
 * Before the Brief entity, the production brief lived as six columns on
 * WorkRequest plus `briefReadyAt`. The backfill copies that text into a Brief
 * so it can go through review. It never approves anything: a ready legacy
 * brief lands IN_REVIEW, everything else lands DRAFT, and a human decides.
 */

export const LEGACY_BRIEF_ORIGIN = 'legacy_request';
export const LEGACY_BRIEF_DELIVERABLE_KEY = 'request-main';

export type LegacyBriefRequest = {
  id: string;
  status: string;
  titleEn: string;
  titleAr: string;
  briefObjectiveEn: string;
  briefObjectiveAr: string;
  briefAudienceEn: string;
  briefAudienceAr: string;
  briefKeyMessageEn: string;
  briefKeyMessageAr: string;
  briefReadyAt: Date | null;
  /** Oldest requests kept the brief as a marker payload inside the description. */
  descriptionEn?: string | null;
  channels: string[];
  formats: string[];
  dueAt: Date | null;
  /** Number of WorkTasks already attached to the request. */
  taskCount: number;
};

export type LegacyBriefSkipReason = 'request_closed' | 'request_has_tasks' | 'no_brief_content';

export type LegacyBriefPlan =
  | { action: 'skip'; reason: LegacyBriefSkipReason }
  | {
      action: 'create';
      status: Extract<BriefStatus, 'DRAFT' | 'IN_REVIEW'>;
      title: string;
      content: BriefContent;
    };

const CLOSED_STATUSES = new Set(['DONE', 'CANCELLED']);

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/**
 * Column values, falling back to the pre-column description marker
 * (`__OMA_BRIEF_V1__`, English only) when every column is empty.
 */
function legacyBriefText(req: LegacyBriefRequest) {
  const columns = {
    objectiveEn: req.briefObjectiveEn,
    objectiveAr: req.briefObjectiveAr,
    audienceEn: req.briefAudienceEn,
    audienceAr: req.briefAudienceAr,
    keyMessageEn: req.briefKeyMessageEn,
    keyMessageAr: req.briefKeyMessageAr,
  };
  if (Object.values(columns).some((v) => v.trim().length > 0)) return columns;
  const marker = briefFieldsFromDescription(req.descriptionEn);
  return {
    ...columns,
    objectiveEn: marker?.objective ?? '',
    audienceEn: marker?.audience ?? '',
    keyMessageEn: marker?.keyMessage ?? '',
  };
}

function hasLegacyBriefText(req: LegacyBriefRequest): boolean {
  const t = legacyBriefText(req);
  return [
    t.objectiveEn,
    t.objectiveAr,
    t.audienceEn,
    t.audienceAr,
    t.keyMessageEn,
    t.keyMessageAr,
  ].some((v) => v.trim().length > 0);
}

export function legacyBriefContent(req: LegacyBriefRequest): BriefContent {
  const titleEn = clip(req.titleEn, 160) || clip(req.titleAr, 160) || req.id;
  const titleAr = clip(req.titleAr, 160) || titleEn;
  const t = legacyBriefText(req);
  const channels = [...new Set(req.channels.map((c) => clip(c, 60)).filter(Boolean))].slice(0, 20);
  return briefContentSchema.parse({
    objective_en: clip(t.objectiveEn, 1000),
    objective_ar: clip(t.objectiveAr, 1000),
    audience_en: clip(t.audienceEn, 1000),
    audience_ar: clip(t.audienceAr, 1000),
    key_message_en: clip(t.keyMessageEn, 1000),
    key_message_ar: clip(t.keyMessageAr, 1000),
    channels,
    due_at: req.dueAt ? req.dueAt.toISOString() : null,
    deliverables: [
      {
        key: LEGACY_BRIEF_DELIVERABLE_KEY,
        title_en: titleEn,
        title_ar: titleAr,
        format: clip(req.formats.filter(Boolean).join(', '), 60),
        channel: channels.length === 1 ? channels[0] : '',
      },
    ],
  });
}

/**
 * Decides what the backfill does with one request. Pure and deterministic.
 * - Closed requests and requests that already produced tasks are skipped, so
 *   converting the new brief can never duplicate work that already exists.
 * - Requests without any brief text are skipped (nothing to review).
 * - `briefReadyAt` + a complete brief → IN_REVIEW; otherwise DRAFT. Never APPROVED.
 */
export function planLegacyBrief(req: LegacyBriefRequest): LegacyBriefPlan {
  if (CLOSED_STATUSES.has(req.status)) return { action: 'skip', reason: 'request_closed' };
  if (req.taskCount > 0) return { action: 'skip', reason: 'request_has_tasks' };
  if (!hasLegacyBriefText(req)) return { action: 'skip', reason: 'no_brief_content' };
  const content = legacyBriefContent(req);
  const ready = req.briefReadyAt !== null && briefSubmitReadiness(content).ready;
  return {
    action: 'create',
    status: ready ? 'IN_REVIEW' : 'DRAFT',
    title: clip(req.titleEn, 200) || clip(req.titleAr, 200) || req.id,
    content,
  };
}
