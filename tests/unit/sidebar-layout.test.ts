import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('workspace sidebar layout', () => {
  it('stacks Analytics, Pages, and More as compact groups without vertical grid stretch', () => {
    const css = read('apps/web/src/styles/shell.css');
    const fix = css.slice(css.lastIndexOf('Sidebar groups stay content-height'));
    expect(fix).toContain('display: flex !important');
    expect(fix).toContain('flex-direction: column !important');
    expect(fix).toContain('justify-content: flex-start !important');
    expect(fix).toContain('.oma-nav-pages__head');
    expect(fix).toContain('margin-block-start: 0 !important');
  });

  it('keeps account and notifications controls in one shared footer for desktop and mobile workspaces', () => {
    const chrome = read('apps/web/src/components/shell/shell-chrome.tsx');
    expect(chrome).toContain('function RailUtilities()');
    expect(chrome).toContain('data-testid="shell-rail-utilities"');
    expect(chrome.match(/<RailUtilities \/>/g)).toHaveLength(2);
    expect(chrome).toContain('<UserMenu />');
    expect(chrome).toContain('<NotificationsBell />');

    const css = read('apps/web/src/styles/shell.css');
    const fix = css.slice(css.lastIndexOf('Sidebar groups stay content-height'));
    expect(fix).toContain("[data-collapsed='true'] .oma-rail-footer");
    expect(fix).toContain('flex-direction: column !important');
  });

  it('preserves working account and notifications destinations', () => {
    const account = read('apps/web/src/components/shell/user-menu.tsx');
    const notifications = read('apps/web/src/components/shell/notifications-bell.tsx');
    expect(account).toContain('data-testid="shell-user-menu-trigger"');
    expect(account).toContain('href="/app/account"');
    expect(notifications).toContain('data-testid="shell-notifications-trigger"');
    expect(notifications).toContain('href="/app/notifications"');
  });

  it('uses the account settings card as the single workspace settings entry point', () => {
    const chrome = read('apps/web/src/components/shell/shell-chrome.tsx');
    const account = read('apps/web/src/components/shell/user-menu.tsx');
    const workspaceRow = read('apps/web/src/components/shell/workspace-row.tsx');
    expect(chrome).toContain("import { WorkspaceRow } from './workspace-row';");
    expect(chrome).not.toContain('WorkspaceSettingsPanel');
    expect(chrome).toContain('<SettingsPanel');
    expect(workspaceRow).toContain('onOpenSettings');
    expect(account).toContain('data-testid="shell-user-menu-settings"');
    expect(account).toContain('openSettings();');
  });

  it('selects a child navigation page without also selecting its parent page', () => {
    const chrome = read('apps/web/src/components/shell/shell-chrome.tsx');
    const navLink = read('apps/web/src/components/shell/nav-link.tsx');
    expect(chrome).toContain('exact={Boolean(item.children)}');
    expect(navLink).toContain('exact?: boolean');
    expect(navLink).toContain('exact && !sectionPath');
    expect(navLink).toContain('pathname === href');
  });

  it('keeps utility triggers visible and prevents drawer transform leftovers', () => {
    const account = read('apps/web/src/components/shell/user-menu.tsx');
    const notifications = read('apps/web/src/components/shell/notifications-bell.tsx');
    const drawers = read('apps/web/src/styles/side-drawers.css');
    expect(account).toContain('oma-rail-utility-trigger');
    expect(notifications).toContain('oma-rail-utility-trigger');
    expect(drawers).toContain('position: relative !important');
    expect(drawers).toContain('.oma-notifications-drawer {');
    expect(drawers).toContain('z-index: 1300 !important');
    expect(drawers).toContain('transform: none !important');
  });

  it('pins the rail footer inside a full-height dvh flex column with scrollable nav', () => {
    const css = read('apps/web/src/styles/shell.css');
    expect(css).toContain('height: 100dvh !important');
    expect(css).toContain('max-height: 100dvh !important');
    expect(css).toContain('.oma-rail > .oma-nav');
    expect(css).toContain('overflow-y: auto !important');
    expect(css).toContain('.oma-rail > .oma-rail-footer');
    expect(css).toContain('flex: 0 0 auto !important');
  });

  it('removes closed mobile nav drawer leftovers so no transparent strip remains', () => {
    const css = read('apps/web/src/styles/shell.css');
    const drawers = read('apps/web/src/styles/side-drawers.css');
    expect(css).toContain('.oma-drawer.oma-drawer--nav:not(.ant-drawer-open)');
    expect(css).toContain('display: none !important');
    expect(drawers).toContain('.oma-drawer.oma-drawer--nav:not(.ant-drawer-open)');
    expect(drawers).toContain('.oma-drawer.oma-drawer--nav .ant-drawer-mask');
  });

  it('loads the shared side-drawer layer for filters and notification panels', () => {
    const globals = read('apps/web/src/app/globals.css');
    const drawers = read('apps/web/src/styles/side-drawers.css');
    expect(globals).toContain("@import '../styles/side-drawers.css';");
    expect(drawers).toContain('.oma-tasks-filter-drawer .ant-drawer-content-wrapper');
    expect(drawers).toContain('.oma-filter-sidepanel');
    expect(drawers).toContain('.oma-shell > .oma-rail > .oma-rail-footer');
    expect(drawers).toContain('position: relative !important');
    expect(drawers).toContain('oma-rail-utility-trigger');
    expect(drawers).toContain('.oma-notifications-drawer .oma-notifications-panel--drawer');
    expect(drawers).toContain('position: static !important');
    expect(drawers).toContain('.oma-drawer.oma-drawer--nav .ant-drawer-content-wrapper');
    expect(drawers).toContain('.oma-drawer.oma-drawer--nav .oma-mobile-drawer-nav');
    expect(drawers).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
