export type StrategyAiFocus = 'overview' | 'foundation' | 'organic' | 'paid' | 'review';

/** Proposal section keys shown for each workspace surface. */
export function proposalSectionsForFocus(focus: StrategyAiFocus): Set<string> | null {
  switch (focus) {
    case 'foundation':
      return new Set(['foundation', 'audience_goals', 'kpi', 'other']);
    case 'organic':
      return new Set(['organic']);
    case 'paid':
      return new Set(['paid']);
    case 'review':
      return new Set(['foundation', 'organic', 'paid', 'audience_goals', 'kpi', 'other']);
    case 'overview':
      return null;
    default:
      return null;
  }
}

export type StrategyAiFocusRequest = 'foundation' | 'organic' | 'paid' | 'full';

export function aiFocusForApi(focus: StrategyAiFocus): StrategyAiFocusRequest {
  if (focus === 'foundation') return 'foundation';
  if (focus === 'organic') return 'organic';
  if (focus === 'paid') return 'paid';
  return 'full';
}
