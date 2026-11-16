import { z } from 'zod';

/**
 * Brief aggregate (DEC-019).
 *
 * A brief is the reviewed agreement on what to produce. It moves through
 * DRAFT → IN_REVIEW → APPROVED | CHANGES_REQUESTED → CONVERTED (+ CANCELLED).
 * Only APPROVED briefs convert to tasks; approving is always a human decision.
 */

export const BRIEF_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'CONVERTED',
  'CANCELLED',
] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];

export const BRIEF_ACTIONS = [
  'edit',
  'submit',
  'approve',
  'request_changes',
  'revise',
  'convert',
  'cancel',
] as const;
export type BriefAction = (typeof BRIEF_ACTIONS)[number];

const TRANSITIONS: Record<BriefAction, { from: readonly BriefStatus[]; to: BriefStatus }> = {
  edit: { from: ['DRAFT', 'CHANGES_REQUESTED'], to: 'DRAFT' },
  submit: { from: ['DRAFT', 'CHANGES_REQUESTED'], to: 'IN_REVIEW' },
  approve: { from: ['IN_REVIEW'], to: 'APPROVED' },
  request_changes: { from: ['IN_REVIEW'], to: 'CHANGES_REQUESTED' },
  revise: { from: ['APPROVED', 'CONVERTED'], to: 'DRAFT' },
  convert: { from: ['APPROVED'], to: 'CONVERTED' },
  cancel: { from: ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'], to: 'CANCELLED' },
};

export function canBriefTransition(status: BriefStatus, action: BriefAction): boolean {
  return TRANSITIONS[action].from.includes(status);
}

/** Target status of an action. `edit` keeps CHANGES_REQUESTED until resubmitted. */
export function briefTransitionTarget(status: BriefStatus, action: BriefAction): BriefStatus {
  if (action === 'edit') return status;
  return TRANSITIONS[action].to;
}

export function allowedBriefActions(status: BriefStatus): BriefAction[] {
  return BRIEF_ACTIONS.filter((a) => canBriefTransition(status, a));
}

export const BRIEF_DELIVERABLE_LIMIT = 30;

const text = (max: number) => z.string().trim().max(max).default('');
const required = (max: number) => z.string().trim().min(1).max(max);

export const briefDeliverableSchema = z.strictObject({
  /** Stable key inside the brief; conversion is idempotent per (version, key). */
  key: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'deliverable key must be a lowercase slug'),
  title_en: required(160),
  title_ar: required(160),
  format: text(60),
  channel: text(60),
  department: text(60),
  due_at: z.iso.datetime({ offset: true }).nullish(),
  notes: text(1000),
});

export const briefContentSchema = z.strictObject({
  objective_en: text(1000),
  objective_ar: text(1000),
  audience_en: text(1000),
  audience_ar: text(1000),
  key_message_en: text(1000),
  key_message_ar: text(1000),
  cta_en: text(300),
  cta_ar: text(300),
  channels: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  mandatories: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  references: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  budget_note: text(500),
  due_at: z.iso.datetime({ offset: true }).nullish(),
  pillar_key: z.string().trim().max(48).nullish(),
  deliverables: z.array(briefDeliverableSchema).max(BRIEF_DELIVERABLE_LIMIT).default([]),
});

export type BriefContent = z.infer<typeof briefContentSchema>;
export type BriefDeliverable = z.infer<typeof briefDeliverableSchema>;

export function emptyBriefContent(): BriefContent {
  return briefContentSchema.parse({});
}

export type BriefIssue = { path: string; code: string; message: string };

/** Content checks that are not expressible per-field (run on every save). */
export function briefContentIssues(content: BriefContent): BriefIssue[] {
  const issues: BriefIssue[] = [];
  const seen = new Set<string>();
  content.deliverables.forEach((d, i) => {
    if (seen.has(d.key)) {
      issues.push({
        path: `deliverables.${i}.key`,
        code: 'DUPLICATE_DELIVERABLE',
        message: `Duplicate deliverable key ${d.key}`,
      });
    }
    seen.add(d.key);
  });
  return issues;
}

/**
 * Submit gate: objective, audience and key message in at least one language,
 * and at least one deliverable to produce.
 */
export function briefSubmitReadiness(content: BriefContent): { ready: boolean; missing: string[] } {
  const missing: string[] = [];
  const either = (en: string, ar: string) => Boolean(en.trim() || ar.trim());
  if (!either(content.objective_en, content.objective_ar)) missing.push('objective');
  if (!either(content.audience_en, content.audience_ar)) missing.push('audience');
  if (!either(content.key_message_en, content.key_message_ar)) missing.push('key_message');
  if (content.deliverables.length === 0) missing.push('deliverables');
  return { ready: missing.length === 0, missing };
}

/**
 * Self-approval rule (DEC-019 §5): the author of the version under review may
 * approve it only when nobody else in the brand can approve. Always audited.
 */
export function briefSelfApprovalBlocked(input: {
  approverUserId: string;
  authorUserId: string;
  otherApproverCount: number;
}): boolean {
  return input.approverUserId === input.authorUserId && input.otherApproverCount > 0;
}

export function briefEntityEnabled(env: { BRIEF_ENTITY_ENABLED?: string } = process.env): boolean {
  return (env.BRIEF_ENTITY_ENABLED ?? '').trim().toLowerCase() !== 'false';
}

export type StrategyBriefSeed = {
  goals: string[];
  keyMessages: string[];
  positioning: string;
  audiences: string[];
  channels: string[];
  pillar?: { key: string; name_en: string; name_ar: string } | null;
};

/**
 * Deterministic brief prefill from an APPROVED strategy version. It only copies
 * approved strategy text; nothing is invented and the result is a DRAFT.
 */
export function briefContentFromStrategy(seed: StrategyBriefSeed): BriefContent {
  const join = (values: string[]) => values.filter(Boolean).join('\n').slice(0, 1000);
  const pillar = seed.pillar ?? null;
  return briefContentSchema.parse({
    objective_en: join(seed.goals),
    audience_en: join(seed.audiences),
    key_message_en: join(seed.keyMessages.length ? seed.keyMessages : [seed.positioning]),
    channels: [...new Set(seed.channels)].slice(0, 20),
    pillar_key: pillar?.key ?? null,
    deliverables: pillar
      ? [
          {
            key: `${pillar.key}-content`.slice(0, 48),
            title_en: `${pillar.name_en} content`.slice(0, 160),
            title_ar: `محتوى ${pillar.name_ar}`.slice(0, 160),
          },
        ]
      : [],
  });
}
