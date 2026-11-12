import type { PlanWorkRequestDraft } from './plan-work-requests';

export type PlanRequestComparable = {
  plan_source_key: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  channels: string[];
  formats: string[];
  brief_objective_en: string;
  brief_audience_en: string;
  brief_key_message_en: string;
};

export type PlanRequestImpactStatus = 'aligned' | 'drifted' | 'orphaned';

export type PlanRequestImpactRow = {
  request_id: string;
  plan_source_key: string;
  source_strategy_version_id: string;
  status: PlanRequestImpactStatus;
  changed_fields: string[];
  has_open_task: boolean;
};

function normList(values: string[]): string[] {
  return [...values]
    .map((v) => v.trim())
    .filter(Boolean)
    .sort();
}

function normText(value: string): string {
  return value.trim();
}

export function comparableFromDraft(draft: PlanWorkRequestDraft): PlanRequestComparable {
  return {
    plan_source_key: draft.plan_source_key,
    title_en: normText(draft.title.en),
    title_ar: normText(draft.title.ar),
    description_en: normText(draft.description.en),
    description_ar: normText(draft.description.ar),
    channels: normList(draft.channels),
    formats: normList(draft.formats),
    brief_objective_en: normText(draft.brief.objective.en),
    brief_audience_en: normText(draft.brief.audience.en),
    brief_key_message_en: normText(draft.brief.keyMessage.en),
  };
}

export function comparableFromStored(input: {
  planSourceKey: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  channels: string[];
  formats: string[];
  briefObjectiveEn: string;
  briefAudienceEn: string;
  briefKeyMessageEn: string;
}): PlanRequestComparable {
  return {
    plan_source_key: input.planSourceKey,
    title_en: normText(input.titleEn),
    title_ar: normText(input.titleAr),
    description_en: normText(input.descriptionEn),
    description_ar: normText(input.descriptionAr),
    channels: normList(input.channels),
    formats: normList(input.formats),
    brief_objective_en: normText(input.briefObjectiveEn),
    brief_audience_en: normText(input.briefAudienceEn),
    brief_key_message_en: normText(input.briefKeyMessageEn),
  };
}

const FIELD_CHECKS: Array<{
  field: string;
  pick: (c: PlanRequestComparable) => string | string[];
}> = [
  { field: 'title', pick: (c) => c.title_en },
  { field: 'description', pick: (c) => c.description_en },
  { field: 'channels', pick: (c) => c.channels },
  { field: 'formats', pick: (c) => c.formats },
  { field: 'brief_objective', pick: (c) => c.brief_objective_en },
  { field: 'brief_audience', pick: (c) => c.brief_audience_en },
  { field: 'brief_key_message', pick: (c) => c.brief_key_message_en },
];

function listChangedFields(
  stored: PlanRequestComparable,
  draftComparable: PlanRequestComparable,
): string[] {
  const changed: string[] = [];
  for (const check of FIELD_CHECKS) {
    const a = check.pick(stored);
    const b = check.pick(draftComparable);
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.join('|') !== b.join('|')) changed.push(check.field);
    } else if (String(a) !== String(b)) {
      changed.push(check.field);
    }
  }
  return changed;
}

export function assessPlanRequestImpact(
  stored: PlanRequestComparable,
  draft: PlanWorkRequestDraft | undefined,
): { status: PlanRequestImpactStatus; changed_fields: string[] } {
  if (!draft) {
    return { status: 'orphaned', changed_fields: ['plan_item_removed'] };
  }
  const draftComparable = comparableFromDraft(draft);
  const changed_fields = listChangedFields(stored, draftComparable);
  if (changed_fields.length === 0) {
    return { status: 'aligned', changed_fields: [] };
  }
  return { status: 'drifted', changed_fields };
}

export function buildPlanRequestImpactReport(input: {
  drafts: PlanWorkRequestDraft[];
  prior_requests: Array<{
    id: string;
    strategy_version_id: string;
    plan_source_key: string;
    comparable: PlanRequestComparable;
    has_open_task: boolean;
  }>;
}): PlanRequestImpactRow[] {
  const draftByKey = new Map(input.drafts.map((d) => [d.plan_source_key, d]));
  return input.prior_requests
    .filter((r) => r.plan_source_key)
    .map((row) => {
      const draft = draftByKey.get(row.plan_source_key);
      const { status, changed_fields } = assessPlanRequestImpact(row.comparable, draft);
      return {
        request_id: row.id,
        plan_source_key: row.plan_source_key,
        source_strategy_version_id: row.strategy_version_id,
        status,
        changed_fields,
        has_open_task: row.has_open_task,
      };
    });
}
