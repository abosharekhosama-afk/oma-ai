/**
 * DEC-029 4.9: the strategy workspace has three tabs — Plan, Execution, Review.
 * Old routes stay reachable (deep links) and map onto one of the tabs.
 */
export type StrategyTabId = 'plan' | 'execution' | 'review';

export type StrategyTabLink = { href: string; labelKey: string; exact?: boolean };
export type StrategyTab = {
  id: StrategyTabId;
  labelKey: string;
  href: string;
  sections: StrategyTabLink[];
};

export function strategyTabs(brandId: string, strategyId: string): StrategyTab[] {
  const base = `/app/brands/${brandId}/strategies/${strategyId}`;
  return [
    {
      id: 'plan',
      labelKey: 'strategy.tab.plan',
      href: base,
      sections: [
        { href: base, labelKey: 'strategy.nav.overview', exact: true },
        { href: `${base}/edit`, labelKey: 'strategy.nav.foundation' },
        { href: `${base}/organic`, labelKey: 'strategy.nav.organic' },
        { href: `${base}/paid`, labelKey: 'strategy.nav.paid' },
        { href: `${base}/evidence`, labelKey: 'strategy.nav.evidence' },
      ],
    },
    {
      id: 'execution',
      labelKey: 'strategy.tab.execution',
      href: `${base}/execution`,
      sections: [],
    },
    {
      id: 'review',
      labelKey: 'strategy.tab.review',
      href: `${base}/review`,
      sections: [
        { href: `${base}/review`, labelKey: 'strategy.nav.review' },
        { href: `${base}/versions`, labelKey: 'strategy.nav.versions' },
      ],
    },
  ];
}

function matches(pathname: string, link: StrategyTabLink) {
  return link.exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function activeStrategyTab(tabs: StrategyTab[], pathname: string): StrategyTabId {
  for (const tab of tabs) {
    if (matches(pathname, { href: tab.href, labelKey: '', exact: tab.id === 'plan' }))
      return tab.id;
    if (tab.sections.some((s) => matches(pathname, s))) return tab.id;
  }
  return 'plan';
}

export function isActiveSection(pathname: string, link: StrategyTabLink) {
  return matches(pathname, link);
}
