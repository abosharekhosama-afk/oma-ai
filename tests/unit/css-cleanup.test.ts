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
  it('removed byte-identical duplicate block from stage4.css', () => {
    const css = read('apps/web/src/styles/stage4.css');
    const lineCount = css.split('\n').length;
    expect(lineCount).toBeLessThan(5600);
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
    expect(css).not.toMatch(/oma-req-page \.oma-req-mobile[\s\S]{0,60}display:\s*none !important/);
  });

  it('stage4 requests tab uses tokens after cleanup', () => {
    const css = read('apps/web/src/styles/stage4.css');
    expect(css).toContain('var(--oma-workspace-tab-active-bg)');
    expect(css).not.toMatch(/oma-req-page \.oma-ws-tab\.is-active[^}]*#e8f1ff/);
  });
});
