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
};

/** Canonical Stage 1 IA — every major area remains discoverable. */
export const SHELL_NAV_SECTIONS: NavSection[] = [
  {
    id: 'workspace',
    labelKey: 'nav.section.workspace',
    items: [{ href: '/app', labelKey: 'nav.home', icon: 'home' }],
  },
  {
    id: 'intelligence',
    labelKey: 'nav.section.intelligence',
    items: [{ href: '/app/brands', labelKey: 'nav.intelligence', icon: 'brand' }],
  },
  {
    id: 'plan',
    labelKey: 'nav.section.plan',
    items: [
      { href: '/app/campaigns', labelKey: 'nav.campaigns', icon: 'campaigns' },
      { href: '/app/content', labelKey: 'nav.content', icon: 'content' },
    ],
  },
  {
    id: 'produce',
    labelKey: 'nav.section.produce',
    items: [
      { href: '/app/requests', labelKey: 'nav.requests', icon: 'requests' },
      { href: '/app/tasks', labelKey: 'nav.tasks', icon: 'tasks' },
      { href: '/app/deliverables', labelKey: 'nav.deliverables', icon: 'deliverables' },
    ],
  },
  {
    id: 'govern',
    labelKey: 'nav.section.govern',
    items: [
      { href: '/app/reviews', labelKey: 'nav.reviews', icon: 'reviews' },
      { href: '/app/schedule', labelKey: 'nav.schedule', icon: 'schedule' },
      { href: '/app/analytics', labelKey: 'nav.analytics', icon: 'analytics' },
    ],
  },
  {
    id: 'org',
    labelKey: 'nav.section.org',
    items: [
      { href: '/app/team', labelKey: 'nav.team', icon: 'team' },
      { href: '/app/activity', labelKey: 'nav.activity', icon: 'activity' },
      { href: '/app/company/members', labelKey: 'nav.company', icon: 'company' },
      { href: '/app/settings', labelKey: 'nav.settings', icon: 'settings' },
    ],
  },
];

export const SHELL_RAIL_PREF_KEY = 'oma.shell.railCollapsed';
