import { describe, expect, it } from 'vitest';
import {
  SHELL_NAV_SECTIONS,
  SHELL_SECONDARY_NAV,
  SHELL_RAIL_PREF_KEY,
} from '../../apps/web/src/components/shell/nav-config';

describe('Planable-aligned shell nav config', () => {
  it('exposes a primary rail section with Planable items', () => {
    expect(SHELL_NAV_SECTIONS.length).toBeGreaterThanOrEqual(1);
    const primary = SHELL_NAV_SECTIONS.find((s) => s.id === 'primary');
    expect(primary).toBeTruthy();
    expect(primary!.items.length).toBeGreaterThanOrEqual(5);
  });

  it('maps primary routes used in the Planable reference', () => {
    const hrefs = SHELL_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/app/campaigns',
        '/app/content',
        '/app/reviews',
        '/app/analytics',
        '/app/brands',
        '/app/activity',
      ]),
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('keeps secondary product routes discoverable', () => {
    const hrefs = SHELL_SECONDARY_NAV.map((i) => i.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/app',
        '/app/requests',
        '/app/tasks',
        '/app/deliverables',
        '/app/schedule',
        '/app/team',
        '/app/settings',
        '/app/company/members',
      ]),
    );
  });

  it('uses a stable preference key for rail collapse', () => {
    expect(SHELL_RAIL_PREF_KEY).toBe('oma.shell.railCollapsed');
  });
});
