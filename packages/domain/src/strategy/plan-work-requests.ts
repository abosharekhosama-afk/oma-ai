export type PlanWorkRequestDraft = {
  plan_source_key: string;
  track: 'organic' | 'paid';
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  channels: string[];
  formats: string[];
  brief: {
    objective: { en: string; ar: string };
    audience: { en: string; ar: string };
    keyMessage: { en: string; ar: string };
  };
};

function readLabel(item: unknown): string {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    if (typeof record.value === 'string') return record.value.trim();
    if (typeof record.name === 'string') return record.name.trim();
    if (typeof record.label === 'string') return record.label.trim();
  }
  return '';
}

function pair(text: string): { en: string; ar: string } {
  const trimmed = text.trim();
  return { en: trimmed, ar: trimmed };
}

export function buildPlanWorkRequestDrafts(input: {
  strategyName: string;
  foundation: Record<string, unknown>;
  organicEnabled: boolean;
  paidEnabled: boolean;
  organic: {
    pillars?: unknown[];
    channels?: unknown[];
    formats?: unknown[];
    growth_goals?: string | null;
    message_cta?: string | null;
  } | null;
  paid: {
    campaign_objectives?: unknown[];
    formats?: unknown[];
    offer_angle?: string | null;
  } | null;
  audiences: Array<{ name: string; description?: string | null }>;
}): PlanWorkRequestDraft[] {
  const goals = Array.isArray(input.foundation.goals) ? input.foundation.goals : [];
  const keyMessages = Array.isArray(input.foundation.keyMessages)
    ? input.foundation.keyMessages
    : [];
  const positioning =
    readLabel(input.foundation.positioning) ||
    (typeof input.foundation.positioning === 'object'
      ? readLabel((input.foundation.positioning as Record<string, unknown>).value)
      : '');
  const primaryGoal = readLabel(goals[0]) || 'Deliver the approved organic/paid plan';
  const primaryMessage = readLabel(keyMessages[0]) || positioning || input.strategyName;
  const audienceName = input.audiences[0]?.name?.trim() || 'Primary audience';
  const audienceText = input.audiences[0]?.description?.trim() || audienceName;

  const out: PlanWorkRequestDraft[] = [];

  if (input.organicEnabled && input.organic) {
    const pillars = (input.organic.pillars ?? []).map(readLabel).filter(Boolean);
    const channels = (input.organic.channels ?? []).map(readLabel).filter(Boolean);
    const formats = (input.organic.formats ?? []).map(readLabel).filter(Boolean);
    const growth = input.organic.growth_goals?.trim() || '';
    const items = pillars.length > 0 ? pillars : ['Organic content plan'];
    for (let i = 0; i < items.length; i += 1) {
      const pillar = items[i]!;
      out.push({
        plan_source_key: `organic:pillar:${i}`,
        track: 'organic',
        title: pair(`${input.strategyName} — ${pillar}`),
        description: pair(growth || pillar),
        channels,
        formats,
        brief: {
          objective: pair(primaryGoal),
          audience: pair(audienceText),
          keyMessage: pair(pillar || primaryMessage),
        },
      });
    }
  }

  if (input.paidEnabled && input.paid) {
    const objectives = (input.paid.campaign_objectives ?? []).map(readLabel).filter(Boolean);
    const formats = (input.paid.formats ?? []).map(readLabel).filter(Boolean);
    const offer = input.paid.offer_angle?.trim() || '';
    const items = objectives.length > 0 ? objectives : ['Paid campaign plan'];
    for (let i = 0; i < items.length; i += 1) {
      const objective = items[i]!;
      out.push({
        plan_source_key: `paid:objective:${i}`,
        track: 'paid',
        title: pair(`${input.strategyName} — Paid: ${objective}`),
        description: pair(offer || objective),
        channels: [],
        formats,
        brief: {
          objective: pair(objective),
          audience: pair(audienceText),
          keyMessage: pair(offer || primaryMessage),
        },
      });
    }
  }

  return out;
}
