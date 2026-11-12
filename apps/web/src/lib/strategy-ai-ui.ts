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
