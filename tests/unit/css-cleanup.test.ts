import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

function md5Sections(css: string): string[] {
  const lines = css.split('\n');
  const markers = lines.map((l, i) => (l.startsWith('/* ====') ? i : -1)).filter((i) => i >= 0);
  const hashes: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i];
    const end = markers[i + 1] ?? lines.length;
    const chunk = lines.slice(start, end).join('\n');
    let h = 0;
    for (let j = 0; j < chunk.length; j++) h = (h * 31 + chunk.charCodeAt(j)) | 0;
    hashes.push(String(h));
  }
  const dup = hashes.filter((h, i) => hashes.indexOf(h) !== i);
  return dup;
}

describe('css cleanup (stage2/4/5)', () => {
  it('stage4 is modular (phase 3)', () => {
    const index = read('apps/web/src/styles/stage4.css');
    expect(index).toContain("@import './stage4/00-foundation.css'");
    expect(index).toContain("@import './stage4/40-detail-components.css'");
    const foundation = read('apps/web/src/styles/stage4/00-foundation.css');
    expect(foundation).toContain('.oma-req-table-wrap');
  });

  it('stage3 is modular (phase 3)', () => {
    const index = read('apps/web/src/styles/stage3.css');
    expect(index).toContain("@import './stage3/10-content-chrome.css'");
  });

  it('loads canonical icon action stylesheet', () => {
    const globals = read('apps/web/src/app/globals.css');
    expect(globals).toContain('oma-icon-action.css');
    const css = read('apps/web/src/styles/oma-icon-action.css');
    expect(css).toContain('.oma-icon-action');
    expect(css).not.toContain('type="primary"');
  });

  it('globals no longer re-forces mobile-precise deliverable cascade', () => {
    const globals = read('apps/web/src/app/globals.css');
    expect(globals).not.toContain('MOBILE_PRECISE_NOV03 cascade reinforce');
    expect(globals).not.toContain('.oma-deliv-page .oma-deliv-topbar');
  });

  it('loads mobile ops authority last among mobile layers', () => {
    const globals = read('apps/web/src/app/globals.css');
    const ops = globals.indexOf('mobile-ops-authority.css');
    const tight = globals.indexOf('mobile-phone-tight.css');
    const ux = globals.indexOf('mobile-ux-pro-max-reset.css');
    expect(ops).toBeGreaterThan(tight);
    expect(tight).toBeGreaterThan(ux);
  });

  it('uses compact phone icon glyph tokens', () => {
    const css = read('apps/web/src/styles/oma-icon-action.css');
    expect(css).toContain('--oma-icon-action-glyph');
    const tight = read('apps/web/src/styles/mobile-phone-tight.css');
    expect(tight).toContain('--oma-icon-action-size: 32px');
  });

  it('removed byte-identical duplicate block from stage4 (legacy monolith)', () => {
    const css = read('apps/web/src/styles/stage4/40-detail-components.css');
    const lineCount = css.split('\n').length;
    expect(lineCount).toBeLessThan(2600);
    const dupSections = md5Sections(css);
    expect(dupSections.length).toBe(0);
  });

  it('defines workspace semantic color tokens', () => {
    const tokens = read('packages/ui/src/tokens.css');
    expect(tokens).toContain('--oma-workspace-bg:');
    expect(tokens).toContain('--oma-kb-board-bg:');
  });

  it('stage4 does not force requests desktop table on phone', () => {
    const css = read('apps/web/src/styles/stage4.css');
    expect(css).not.toContain('min-width: 980px !important');
  });

  it('requests phone layer prefers compact table over card list', () => {
    const phone = read('apps/web/src/styles/mobile-requests-phone.css');
    const finalCss = read('apps/web/src/styles/oma-mobile-cascade-final.css');
    const listening = read('apps/web/src/styles/inbox-listening.css');
    expect(finalCss).toMatch(/oma-req-desktop[\s\S]{0,80}display:\s*block !important/);
    expect(finalCss).toMatch(/oma-req-mobile[\s\S]{0,80}display:\s*none !important/);
    expect(finalCss).toMatch(/oma-plx-requests-table[\s\S]{0,80}display:\s*block !important/);
    expect(finalCss).toContain('oma-plx-requests-panel--flat');
    expect(listening).toMatch(/oma-plx-requests-cards[\s\S]{0,80}display:\s*none !important/);
    expect(finalCss).toContain('border-bottom-color: var(--oma-workspace-primary-border');
    expect(phone).toContain('.oma-req-page .oma-req-desktop');
  });

  it('layout imports cascade-final after ui-polish', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    const uiIdx = layout.indexOf("ui-polish.css");
    const finalIdx = layout.indexOf('oma-mobile-cascade-final.css');
    expect(uiIdx).toBeGreaterThan(-1);
    expect(finalIdx).toBeGreaterThan(uiIdx);
  });

  it('approvals board uses flexible mobile columns', () => {
    const css = read('apps/web/src/styles/approvals-planable.css');
    expect(css).toMatch(/oma-plx-approvals__columns[\s\S]{0,200}display:\s*flex/);
    expect(css).toMatch(/oma-plx-approvals__column-wrap[\s\S]{0,80}70vw/);
    expect(css).toContain('.oma-shim-approvals');
    expect(css).toContain('oma-plx-approvals-channels--portal');
    expect(css).toContain('oma-plx-approvals-ch-dd__trigger.oma-icon-action');
  });

  it('content mobile cascade enables calendar horizontal scroll', () => {
    const css = read('apps/web/src/styles/oma-mobile-cascade-final.css');
    expect(css).toContain('.oma-cal-main');
    expect(css).toMatch(/--oma-cal-day-col:\s*calc\(\(100vw - 20px\) \/ 3\)/);
    expect(css).toContain('.oma-cal-hscroll');
    expect(css).toContain('.oma-compose-overlay');
    expect(css).toContain('.oma-card-actions-btn');
  });

  it('uses fluid compact content rows on phone', () => {
    const mobile = read('apps/web/src/styles/mobile-precise-nov03.css');
    expect(mobile).not.toContain('920px');
    expect(mobile).toContain("'check thumb main actions'");
    expect(mobile).toContain('minmax(0, 1fr)');

    const reset = read('apps/web/src/styles/mobile-ux-pro-max-reset.css');
    expect(reset).toContain('--oma-mobile-gap: 6px;');
    expect(reset).toContain('--oma-mobile-section: 10px;');
  });

  it('stage4 requests tab uses tokens after cleanup', () => {
    const css = read('apps/web/src/styles/stage4/20-ops-deliverables-tasks.css');
    expect(css).toContain('var(--oma-workspace-tab-active-bg)');
    expect(css).not.toMatch(/oma-req-page \.oma-ws-tab\.is-active[^}]*#e8f1ff/);
  });
});
