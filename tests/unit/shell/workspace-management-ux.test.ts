import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(rel), 'utf8');

describe('workspace management menus and mobile layout', () => {
  it('turns the company name into a real workspace switcher with adjacent actions', () => {
    const dashboard = read('apps/web/src/app/(app)/app/select-company/planable-dashboard.tsx');
    expect(dashboard).toContain('data-testid="workspace-switcher"');
    expect(dashboard).toContain('workspace-switcher-option-');
    expect(dashboard).toContain('void activate(m.tenant_id)');
    expect(dashboard).toContain('plx-company-actions');
    expect(dashboard).toContain('isPlatformAdmin');
    expect(dashboard).toContain('/app/admin/billing');
    expect(dashboard).toContain("activate(m.tenant_id, '/app?settings=workspace')");
    expect(dashboard).toContain("activate(m.tenant_id, '/app/team')");
    expect(dashboard).toContain("activate(m.tenant_id, '/app/approvals')");
    expect(dashboard).toContain('activateGen');
    expect(dashboard).toContain('handleMenuKeyDown');
    expect(dashboard).toContain('actionError');
  });

  it('makes the header profile menu open downward and wires real destinations', () => {
    const dashboard = read('apps/web/src/app/(app)/app/select-company/planable-dashboard.tsx');
    const userMenu = read('apps/web/src/components/shell/user-menu.tsx');
    const popover = read('apps/web/src/components/shell/shell-popover.tsx');
    expect(dashboard).toContain('UserMenu variant="header"');
    expect(dashboard).not.toContain('HelpIcon');
    expect(userMenu).toContain("variant?: 'rail' | 'header'");
    expect(userMenu).toContain('headerPlacement');
    expect(userMenu).toContain('href="/app/account"');
    expect(userMenu).toContain('billingHref');
    expect(userMenu).toContain('/app/admin/billing');
    expect(userMenu).toContain('/app/billing');
    expect(userMenu).toContain('confirm-logout-dialog');
    expect(popover).toContain('placement?:');
  });

  it('keeps brand and workspace action menus on real routes and visible on touch', () => {
    const dashboard = read('apps/web/src/app/(app)/app/select-company/planable-dashboard.tsx');
    const css = read('apps/web/src/app/(app)/app/select-company/planable-dashboard.css');
    expect(dashboard).toContain('data-testid="workspace-card-actions-menu"');
    expect(dashboard).toContain("t('brand.detail.connectCta')");
    expect(dashboard).toContain("t('nav.content')");
    expect(dashboard).toContain('/app/brands/${b.id}/settings?tab=approvals');
    expect(css).toContain('minmax(min(100%, 370px), 1fr)');
    expect(css).toContain('@media (max-width: 760px)');
    expect(css).toContain('overflow-x: hidden');
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
  });
});
