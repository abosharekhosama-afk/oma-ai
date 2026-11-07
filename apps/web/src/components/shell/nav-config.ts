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
  | 'user'
  | 'filter'
  | 'calendar-view'
  | 'list-view'
  | 'grid-view'
  | 'chevron-down'
  | 'check';

export type NavItem = {
  href: string;
  labelKey: string;
  icon: NavIconId;
  /** Prefix for active state + sub-nav visibility when `href` is a default child route. */
  sectionPath?: string;
  /** Sub-pages shown under the item while its section is open (Planable: Analytics › Overview / Competitors). */
  children?: Array<{ href: string; labelKey: string }>;
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
      { href: '/app/approvals', labelKey: 'views.my_approvals', icon: 'check' },
      {
        href: '/app/inbox/comments',
        sectionPath: '/app/inbox',
        labelKey: 'nav.inbox',
        icon: 'requests',
        children: [
          { href: '/app/inbox/comments', labelKey: 'inbox.nav.comments' },
          { href: '/app/inbox/dms', labelKey: 'inbox.nav.dms' },
        ],
      },
      { href: '/app/campaigns', labelKey: 'nav.campaigns', icon: 'campaigns' },
      {
        href: '/app/analytics',
        labelKey: 'nav.analytics',
        icon: 'analytics',
        children: [
          { href: '/app/analytics', labelKey: 'analytics.nav.overview' },
          { href: '/app/analytics/competitors', labelKey: 'analytics.nav.competitors' },
        ],
      },
      {
        href: '/app/listening/brand',
        sectionPath: '/app/listening',
        labelKey: 'nav.listening',
        icon: 'filter',
        children: [
          { href: '/app/listening/brand', labelKey: 'listening.nav.brand' },
          { href: '/app/listening/topic', labelKey: 'listening.nav.topic' },
          { href: '/app/listening/competitors', labelKey: 'listening.nav.competitors' },
          { href: '/app/listening/alerts', labelKey: 'listening.nav.alerts' },
        ],
      },
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
    ],
  },
];

export const SHELL_NAV_MORE_PREF_KEY = 'oma.shell.moreOpen';

/** True when the path belongs to an item in the given section (auto-opens "More"). */
export function sectionContainsPath(section: NavSection, pathname: string): boolean {
  return section.items.some((i) => {
    const base = i.sectionPath ?? i.href;
    return base === '/app' ? pathname === '/app' : pathname.startsWith(base);
  });
}

export const SHELL_RAIL_PREF_KEY = 'oma.shell.railCollapsed';
