import { describe, expect, it } from 'vitest';
import {
  SHELL_NAV_SECTIONS,
  SHELL_RAIL_PREF_KEY,
} from '../../apps/web/src/components/shell/nav-config';

describe('Stage 1 shell nav config', () => {
  it('groups navigation into at least four labeled sections', () => {
    expect(SHELL_NAV_SECTIONS.length).toBeGreaterThanOrEqual(4);
    for (const section of SHELL_NAV_SECTIONS) {
      expect(section.labelKey).toMatch(/^nav\.section\./);
      expect(section.items.length).toBeGreaterThan(0);
    }
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
