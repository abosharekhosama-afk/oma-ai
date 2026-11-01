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

  it('loads the shared side-drawer layer for filters and notification panels', () => {
    const globals = read('apps/web/src/app/globals.css');
    const drawers = read('apps/web/src/styles/side-drawers.css');
    expect(globals).toContain("@import '../styles/side-drawers.css';");
    expect(drawers).toContain('.oma-tasks-filter-drawer .ant-drawer-content-wrapper');
    expect(drawers).toContain('.oma-filter-sidepanel');
    expect(drawers).toContain('.oma-shell > .oma-rail > .oma-rail-footer');
    expect(drawers).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
