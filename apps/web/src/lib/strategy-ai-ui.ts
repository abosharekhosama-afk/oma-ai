export type StrategyAiProposalItem = {
  field: string;
  value: string;
  kind?: string;
  confidence?: number;
};

export function groupProposalItems(
  items: StrategyAiProposalItem[],
): Map<string, StrategyAiProposalItem[]> {
  const map = new Map<string, StrategyAiProposalItem[]>();
  for (const item of items) {
    const section = item.field.includes('.') ? item.field.split('.')[0]! : 'other';
    const list = map.get(section) ?? [];
    list.push(item);
    map.set(section, list);
  }
  return map;
}

function pushList(
  items: StrategyAiProposalItem[],
  section: string,
  values: unknown,
  kind = 'proposal',
) {
  if (!Array.isArray(values)) return;
  for (const raw of values) {
    const value = String(raw ?? '').trim();
    if (!value) continue;
    items.push({ field: section, value, kind });
  }
}

function pushOne(items: StrategyAiProposalItem[], field: string, value: unknown, kind = 'proposal') {
  const text = value == null ? '' : String(value).trim();
  if (!text) return;
  items.push({ field, value: text, kind });
}

/**
 * Normalizes strategy AI propose responses: legacy `items[]` or v2 structured contract.
 */
export function strategyProposalToItems(proposal: unknown): StrategyAiProposalItem[] {
  if (!proposal || typeof proposal !== 'object') return [];
  const record = proposal as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    return record.items
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const item = row as Record<string, unknown>;
        const value = String(item.value ?? '').trim();
        const field = String(item.field ?? '').trim();
        if (!field || !value) return null;
        return {
          field,
          value,
          kind: typeof item.kind === 'string' ? item.kind : 'proposal',
          confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
        } satisfies StrategyAiProposalItem;
      })
      .filter(Boolean) as StrategyAiProposalItem[];
  }

  const items: StrategyAiProposalItem[] = [];
  const foundation = record.foundation;
  if (foundation && typeof foundation === 'object') {
    const f = foundation as Record<string, unknown>;
    pushList(items, 'foundation.goals', f.goals);
    pushOne(items, 'foundation.positioning', f.positioning);
    pushList(items, 'foundation.keyMessages', f.keyMessages);
    pushList(items, 'foundation.constraints', f.constraints);
  }

  pushList(items, 'audience_goals', record.audienceGoals);
  pushList(items, 'kpi', record.kpis);

  const organic = record.organic;
  if (organic && typeof organic === 'object') {
    const o = organic as Record<string, unknown>;
    pushList(items, 'organic.pillars', o.pillars);
    pushList(items, 'organic.channels', o.channels);
    pushList(items, 'organic.formats', o.formats);
    pushOne(items, 'organic.frequency', o.frequency);
  }

  const paid = record.paid;
  if (paid && typeof paid === 'object') {
    const p = paid as Record<string, unknown>;
    pushList(items, 'paid.campaignObjectives', p.campaignObjectives);
    pushOne(items, 'paid.offerAngle', p.offerAngle);
    pushList(items, 'paid.placements', p.placements);
  }

  if (typeof record.rationale === 'string' && record.rationale.trim()) {
    items.push({ field: 'other.rationale', value: record.rationale.trim(), kind: 'inference' });
  }

  return items;
}