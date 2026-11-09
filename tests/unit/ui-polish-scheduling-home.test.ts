import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const polish = read('apps/web/src/styles/ui-polish.css');

describe('UI polish: scheduling, account menu, home, primary button, calendar header', () => {
  it('loads ui-polish.css after globals.css so it wins the cascade', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    const g = layout.indexOf("import './globals.css'");
    const p = layout.indexOf("import '../styles/ui-polish.css'");
    expect(g).toBeGreaterThan(-1);
    expect(p).toBeGreaterThan(g);
  });

  it('gives every schedule view a scroll container inside a min-height:0 flex chain', () => {
    expect(polish).toMatch(/\.oma-plx-sched-table-wrap[^{]*\{[^}]*overflow:\s*auto/);
    expect(polish).toContain('.oma-sched-calendar-scroll');
    expect(polish).toMatch(/contain:\s*inline-size paint/);
    expect(polish).toMatch(/\.oma-sched-main[^{]*\{[^}]*overflow-y:\s*auto/);
  });

  it('uses library icons for each schedule view and shows the active one on the trigger', () => {
    const src = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    for (const icon of [
      'CalendarDaysOutlined',
      'AgendaListOutlined',
      'LayoutGridOutlined',
      'TableGridOutlined',
    ]) {
      expect(src).toContain(icon);
      expect(read('apps/web/src/components/ui/lucide-icons.tsx')).toContain(
        `export const ${icon} =`,
      );
    }
    expect(src).toContain('<ActiveViewIcon');
    expect(src).toContain('oma-plx-view-popover__icon');
  });

  it('removes the outer popover card around the account menu (antd v6 container)', () => {
    expect(polish).toMatch(
      /\.oma-shell-popover\.oma-user-menu-pop \.ant-popover-container\s*\{[^}]*background:\s*transparent/,
    );
  });

  it('replaces the blue focus ring with a neutral token', () => {
    const tokens = read('packages/ui/src/tokens.css');
    expect(tokens).toMatch(/--focus-ring:\s*2px solid rgb\(17 24 39/);
    expect(tokens).not.toMatch(/--focus-ring:\s*2px solid var\(--oma-primary\)/);
  });

  it('fixes the home week strip and awaiting rows on phones', () => {
    expect(polish).toMatch(/grid-auto-flow:\s*column !important/);
    expect(polish).toMatch(/grid-template-columns:\s*none !important/);
    expect(polish).toMatch(
      /\.oma-plx-home-awaiting-row > \.oma-home-post__link\.oma-plx-inbox-post__external\s*\{[^}]*position:\s*static/,
    );
  });

  it('moves Home "Create post" into the shell header with the page name', () => {
    const chrome = read('apps/web/src/components/shell/shell-chrome.tsx');
    const home = read('apps/web/src/components/home/home-view.tsx');
    expect(home).not.toContain('data-testid="home-create-post"');
    expect(chrome).toMatch(/isHome\s*\?\s*t\('nav\.home'\)/);
    expect(chrome).toContain('href="/app/content?create=1"');
    expect(chrome).not.toMatch(/hideShellCreate =\s*pathname === '\/app'/);
  });

  it('centralizes the white / blue-text primary button on --oma-action-* tokens', () => {
    const tokens = read('packages/ui/src/tokens.css');
    for (const tok of ['--oma-action-bg', '--oma-action-fg', '--oma-action-border']) {
      expect(tokens).toContain(`${tok}:`);
    }
    const globals = read('apps/web/src/app/globals.css');
    expect(globals).toContain('background: var(--oma-action-bg) !important');
    for (const sel of [
      '.oma-home-btn--primary',
      '.oma-plx-content-header-btn--primary',
      '.plx-btn--primary',
      '.oma-pa-btn--primary',
    ]) {
      expect(polish).toContain(sel);
    }
    expect(polish).toContain('background: var(--oma-action-bg) !important');
  });

  it('collapses calendar header buttons to icons with aria-label + title when narrow', () => {
    const src = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    const start = src.indexOf('oma-plx-content-header-actions');
    const block = src.slice(start, src.indexOf('headerSlot,', start));
    expect(block.match(/oma-plx-content-header-btn__label/g)?.length).toBe(5);
    expect(block.match(/\btitle=\{/g)?.length).toBe(5);
    expect(block.match(/aria-label=/g)?.length).toBe(5);
    expect(polish).toMatch(/@media \(max-width: 1279px\)[\s\S]*oma-plx-content-header-btn__label/);
  });

  it('keeps ui-polish.css free of raw hex colors', () => {
    expect(polish).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
