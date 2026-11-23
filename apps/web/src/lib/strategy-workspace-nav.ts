import { isActiveSection, type StrategyTabLink } from './strategy-tabs';

export type StrategyWorkspaceLink = StrategyTabLink & { id: string };

/** Single row of workspace destinations (foundation, organic, paid, review…). */
export function strategyWorkspaceLinks(
  brandId: string,
  strategyId: string,
): StrategyWorkspaceLink[] {
  const base = `/app/brands/${brandId}/strategies/${strategyId}`;
  return [
    { id: 'overview', href: base, labelKey: 'strategy.nav.overview', exact: true },
    { id: 'foundation', href: `${base}/edit`, labelKey: 'strategy.nav.foundation' },
    { id: 'organic', href: `${base}/organic`, labelKey: 'strategy.nav.organic' },
    { id: 'paid', href: `${base}/paid`, labelKey: 'strategy.nav.paid' },
    { id: 'evidence', href: `${base}/evidence`, labelKey: 'strategy.nav.evidence' },
    { id: 'execution', href: `${base}/execution`, labelKey: 'strategy.tab.execution' },
    { id: 'review', href: `${base}/review`, labelKey: 'strategy.tab.review' },
  ];
}

export function activeStrategyWorkspaceLink(pathname: string, links: StrategyWorkspaceLink[]) {
  const match = links.filter((l) => isActiveSection(pathname, l));
  if (match.length === 0) return links[0]!;
  return match.sort((a, b) => b.href.length - a.href.length)[0]!;
}
