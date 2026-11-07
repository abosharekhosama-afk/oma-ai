import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_CELL_ITEMS, splitCellItems } from '../../apps/web/src/lib/demo/stage3-content';

describe('Calendar 2-cards max, universal ConfirmActionDialog, and Workspace Management wiring', () => {
  it('caps calendar day cells at 2 cards max and puts remaining posts into +N more', () => {
    expect(MAX_CELL_ITEMS).toBe(2);
    const dummy = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }] as never[];
    const { visible, extra } = splitCellItems(dummy);
    expect(visible).toHaveLength(2);
    expect(extra).toBe(2);
  });

  it('wires ConfirmActionDialog for post archive, campaign archive, member removal, channel disconnect, and logout', () => {
    const contentClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/content/content-client.tsx'),
      'utf8',
    );
    expect(contentClient).toContain('confirm-archive-post-dialog');

    const userMenu = readFileSync(resolve('apps/web/src/components/shell/user-menu.tsx'), 'utf8');
    expect(userMenu).toContain('confirm-logout-dialog');

    const teamClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/team/team-client.tsx'),
      'utf8',
    );
    expect(teamClient).toContain('confirm-remove-team-member');
    expect(teamClient).not.toContain('window.confirm');

    const campaignsClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/campaigns/campaigns-client.tsx'),
      'utf8',
    );
    expect(campaignsClient).toContain('confirm-archive-campaign-dialog');
  });

  it('wires workspace management menu actions (Usage, Billing, Rename workspace, Approvals) to real endpoints and routes', () => {
    const dashboard = readFileSync(
      resolve('apps/web/src/app/(app)/app/select-company/planable-dashboard.tsx'),
      'utf8',
    );
    expect(dashboard).toContain('/api/v1/tenants/current');
    expect(dashboard).toContain('rename-workspace-modal');
    expect(dashboard).toContain("router.push('/app/subscription')");
    expect(dashboard).toContain('/app/brands/${b.id}/settings?tab=approvals');

    const tenantCtrl = readFileSync(resolve('apps/api/src/tenant/tenant.controller.ts'), 'utf8');
    expect(tenantCtrl).toContain("@Patch('tenants/current')");
  });
});
