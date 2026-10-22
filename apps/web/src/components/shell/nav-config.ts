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
  | 'approvals'
  | 'inbox'
  | 'listening';

export type NavItem = {
  href: string;
  labelKey: string;
  /** Optional hardcoded fallback when i18n key is missing */
  labelFallback?: string;
  icon: NavIconId;
};

export type NavSection = {
  id: string;
  labelKey: string;
  items: NavItem[];
};

/**
 * Planable-aligned primary rail IA.
 * Routes map to existing OMA pages; labels mirror the reference screenshots.
 */
export const SHELL_NAV_SECTIONS: NavSection[] = [
  {
    id: 'primary',
    labelKey: 'nav.section.primary',
    items: [
      { href: '/app/content', labelKey: 'nav.content', labelFallback: 'Content', icon: 'content' },
      {
        href: '/app/campaigns',
        labelKey: 'nav.campaigns',
        labelFallback: 'Campaigns',
        icon: 'campaigns',
      },
      {
        href: '/app/reviews',
        labelKey: 'nav.approvals',
        labelFallback: 'My approvals',
        icon: 'approvals',
      },
      {
        href: '/app/activity',
        labelKey: 'nav.socialInbox',
        labelFallback: 'Social inbox',
        icon: 'inbox',
      },
      {
        href: '/app/analytics',
        labelKey: 'nav.analytics',
        labelFallback: 'Analytics',
        icon: 'analytics',
      },
      {
        href: '/app/brands',
        labelKey: 'nav.socialListening',
        labelFallback: 'Social listening',
        icon: 'listening',
      },
    ],
  },
];

/** Secondary / overflow items kept reachable from settings or command search */
export const SHELL_SECONDARY_NAV: NavItem[] = [
  { href: '/app', labelKey: 'nav.home', labelFallback: 'Home', icon: 'home' },
  { href: '/app/requests', labelKey: 'nav.requests', labelFallback: 'Requests', icon: 'requests' },
  { href: '/app/tasks', labelKey: 'nav.tasks', labelFallback: 'Tasks', icon: 'tasks' },
  {
    href: '/app/deliverables',
    labelKey: 'nav.deliverables',
    labelFallback: 'Deliverables',
    icon: 'deliverables',
  },
  { href: '/app/schedule', labelKey: 'nav.schedule', labelFallback: 'Schedule', icon: 'schedule' },
  { href: '/app/team', labelKey: 'nav.team', labelFallback: 'Team', icon: 'team' },
  {
    href: '/app/company/members',
    labelKey: 'nav.company',
    labelFallback: 'Company',
    icon: 'company',
  },
  { href: '/app/settings', labelKey: 'nav.settings', labelFallback: 'Settings', icon: 'settings' },
];

export const SHELL_RAIL_PREF_KEY = 'oma.shell.railCollapsed';
