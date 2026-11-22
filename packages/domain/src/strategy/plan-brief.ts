import {
  BRIEF_DELIVERABLE_LIMIT,
  briefContentSchema,
  type BriefContent,
} from '../work/brief-entity';
import type { CalendarSlot } from './calendar-slots';
import type { PlanWorkRequestDraft } from './plan-work-requests';

/**
 * DEC-029 4.3: plan → brief is the only route from an approved strategy to work.
 * Each plan request gets one brief; each calendar slot becomes a deliverable so
 * approving + converting the brief yields one production task per post.
 */
export function briefContentFromPlanDraft(
  draft: PlanWorkRequestDraft,
  opts: { slots?: CalendarSlot[]; dueAt?: Date | null; cta?: string | null },
): BriefContent {
  const slots = (opts.slots ?? []).slice(0, BRIEF_DELIVERABLE_LIMIT);
  const deliverables = slots.length
    ? slots.map((slot, i) => {
        const day = slot.planned_at.slice(0, 10);
        return {
          key: `slot-${i + 1}`,
          title_en: `${slot.channel} ${slot.format ?? 'post'} — ${day}`.slice(0, 160),
          title_ar: `${slot.channel} ${slot.format ?? 'منشور'} — ${day}`.slice(0, 160),
          channel: slot.channel.slice(0, 60),
          format: (slot.format ?? '').slice(0, 60),
          due_at: new Date(Date.parse(slot.planned_at) - 86_400_000).toISOString(),
          notes: `Planned for ${slot.planned_at} (${slot.slot_key})`,
        };
      })
    : [
        {
          key: 'content',
          title_en: draft.title.en.slice(0, 160),
          title_ar: draft.title.ar.slice(0, 160),
          channel: (draft.channels[0] ?? '').slice(0, 60),
          format: (draft.formats[0] ?? '').slice(0, 60),
          due_at: opts.dueAt ? opts.dueAt.toISOString() : null,
          notes: '',
        },
      ];
  return briefContentSchema.parse({
    objective_en: draft.brief.objective.en.slice(0, 1000),
    objective_ar: draft.brief.objective.ar.slice(0, 1000),
    audience_en: draft.brief.audience.en.slice(0, 1000),
    audience_ar: draft.brief.audience.ar.slice(0, 1000),
    key_message_en: draft.brief.keyMessage.en.slice(0, 1000),
    key_message_ar: draft.brief.keyMessage.ar.slice(0, 1000),
    cta_en: (opts.cta ?? '').slice(0, 300),
    channels: [...new Set(draft.channels)].slice(0, 20),
    due_at: opts.dueAt ? opts.dueAt.toISOString() : null,
    pillar_key: draft.pillar_key ?? null,
    deliverables,
  });
}

/** Map a stored plan source key back to a v2 pillar key (handles legacy index keys). */
export function pillarKeyFromSourceKey(sourceKey: string, pillarKeys: string[]): string | null {
  const m = /^organic:pillar:(.+)$/.exec(sourceKey);
  if (!m) return null;
  const raw = m[1]!;
  if (/^\d+$/.test(raw)) {
    const legacy = `legacy-${Number(raw) + 1}`;
    return pillarKeys.includes(legacy) ? legacy : null;
  }
  return pillarKeys.includes(raw) ? raw : null;
}

export type PillarExecutionCounts = {
  requests: number;
  briefs: Record<string, number>;
  tasks: { open: number; done: number };
  content: {
    planned: number;
    draft: number;
    in_review: number;
    approved: number;
    scheduled: number;
    published: number;
  };
};

export function emptyExecutionCounts(): PillarExecutionCounts {
  return {
    requests: 0,
    briefs: {},
    tasks: { open: 0, done: 0 },
    content: { planned: 0, draft: 0, in_review: 0, approved: 0, scheduled: 0, published: 0 },
  };
}

/** Add one content item to the counters (status + publish rollup). */
export function countContent(
  c: PillarExecutionCounts,
  item: {
    status: string;
    scheduleState?: string | null;
    publishedAt?: Date | null;
    plannedAt?: Date | null;
  },
) {
  if (item.plannedAt) c.content.planned += 1;
  if (item.publishedAt) c.content.published += 1;
  else if (item.status === 'SCHEDULED' || item.scheduleState === 'SCHEDULED')
    c.content.scheduled += 1;
  else if (item.status === 'APPROVED') c.content.approved += 1;
  else if (item.status === 'IN_REVIEW') c.content.in_review += 1;
  else c.content.draft += 1;
}
