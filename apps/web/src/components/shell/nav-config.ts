export type NavIconId =
  | 'home'
  | 'brand'
  | 'campaigns'
  | 'content'
  | 'requests'
  | 'tasks'
  | 'deliverables'
  | 'reviews'
  | 'schedule'
  | 'analytics'
  | 'team'
  | 'activity'
  | 'settings'
  | 'company'
  | 'menu'
  | 'collapse'
  | 'search'
  | 'bell'
  | 'plus'
  | 'user';

export type NavItem = {
  href: string;
  labelKey: string;
  icon: NavIconId;
};

export type NavSection = {
  id: string;
  labelKey: string;
  items: NavItem[];
  /** Planable-style: the main group renders without a visible heading. */
  hideLabel?: boolean;
  /** Secondary routes live in a collapsible "More" group. */
  collapsible?: boolean;
};

/**
 * Planable-style IA: main nav (Home, Content, Campaigns, Analytics), then brand
 * "Pages" (rendered by BrandPagesNav), then every other route under "More".
 */
export const SHELL_NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    labelKey: 'nav.section.workspace',
    hideLabel: true,
    items: [
      { href: '/app', labelKey: 'nav.home', icon: 'home' },
      { href: '/app/content', labelKey: 'nav.content', icon: 'content' },
      { href: '/app/campaigns', labelKey: 'nav.campaigns', icon: 'campaigns' },
      { href: '/app/analytics', labelKey: 'nav.analytics', icon: 'analytics' },
    ],
  },
  {
    id: 'more',
    labelKey: 'nav.section.more',
    collapsible: true,
    items: [
      { href: '/app/brands', labelKey: 'nav.intelligence', icon: 'brand' },
      { href: '/app/requests', labelKey: 'nav.requests', icon: 'requests' },
      { href: '/app/tasks', labelKey: 'nav.tasks', icon: 'tasks' },
      { href: '/app/deliverables', labelKey: 'nav.deliverables', icon: 'deliverables' },
      { href: '/app/reviews', labelKey: 'nav.reviews', icon: 'reviews' },
      { href: '/app/schedule', labelKey: 'nav.schedule', icon: 'schedule' },
      { href: '/app/team', labelKey: 'nav.team', icon: 'team' },
      { href: '/app/activity', labelKey: 'nav.activity', icon: 'activity' },
      { href: '/app/company/members', labelKey: 'nav.company', icon: 'company' },
      { href: '/app/settings', labelKey: 'nav.settings', icon: 'settings' },
    ],
  },
];

export const SHELL_NAV_MORE_PREF_KEY = 'oma.shell.moreOpen';

/** True when the path belongs to an item in the given section (auto-opens "More"). */
export function sectionContainsPath(section: NavSection, pathname: string): boolean {
  return section.items.some((i) => (i.href === '/app' ? pathname === '/app' : pathname.startsWith(i.href)));
}

export const SHELL_RAIL_PREF_KEY = 'oma.shell.railCollapsed';
