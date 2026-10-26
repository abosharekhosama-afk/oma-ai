import { describe, expect, it } from 'vitest';
import {
  SHELL_NAV_SECTIONS,
  SHELL_RAIL_PREF_KEY,
  sectionContainsPath,
} from '../../apps/web/src/components/shell/nav-config';

describe('Stage 1 shell nav config', () => {
  it('uses Planable IA: main nav first, secondary routes under a collapsible More group', () => {
    for (const section of SHELL_NAV_SECTIONS) {
      expect(section.labelKey).toMatch(/^nav\.section\./);
      expect(section.items.length).toBeGreaterThan(0);
    }
    expect(SHELL_NAV_SECTIONS[0]!.items.map((i) => i.href)).toEqual([
      '/app',
      '/app/content',
      '/app/campaigns',
      '/app/analytics',
    ]);
    const more = SHELL_NAV_SECTIONS.find((s) => s.collapsible);
    expect(more?.labelKey).toBe('nav.section.more');
    expect(sectionContainsPath(more!, '/app/tasks/123')).toBe(true);
    expect(sectionContainsPath(SHELL_NAV_SECTIONS[0]!, '/app/tasks')).toBe(false);
  });

  it('preserves every major product route', () => {
    const hrefs = SHELL_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/app',
        '/app/brands',
        '/app/campaigns',
        '/app/content',
        '/app/requests',
        '/app/tasks',
        '/app/deliverables',
        '/app/reviews',
        '/app/schedule',
        '/app/analytics',
        '/app/team',
        '/app/activity',
        '/app/settings',
        '/app/company/members',
      ]),
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('uses a stable preference key for rail collapse', () => {
    expect(SHELL_RAIL_PREF_KEY).toBe('oma.shell.railCollapsed');
  });
});
