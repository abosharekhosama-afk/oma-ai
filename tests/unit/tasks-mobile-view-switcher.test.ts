import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Tasks board view switcher on phone', () => {
  it('lets board and list both be chosen on every viewport', () => {
    const tasks = read('apps/web/src/app/(app)/app/tasks/tasks-client.tsx');
    expect(tasks).toContain('demo-tasks-view-board');
    expect(tasks).toContain('demo-tasks-view-list');
    expect(tasks).toContain('async function changeView(next: ViewMode)');
    expect(tasks).toContain('setView(next)');
    expect(tasks).toContain("window.localStorage.setItem('oma.tasks.defaultView', next)");
    expect(tasks).not.toContain("window.matchMedia('(max-width: 767px)')");
    expect(tasks).not.toContain("if (mq.matches) setView('list')");
  });

  it('keeps the desktop board column width and enables a full-width phone switcher', () => {
    const css = read('apps/web/src/styles/inbox-listening.css');
    expect(css).toContain('.oma-plx-tasks-panel .oma-kb-col {');
    expect(css).toContain('flex: 0 0 272px;');
    const marker = 'Phone: keep the board/list switcher usable';
    const start = css.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('/* Planable-style Reviews queue */', start));
    expect(block).toContain('@media (max-width: 767px)');
    expect(block).toContain('.oma-plx-tasks .oma-plx-deliv-view-row');
    expect(block).toContain('display: flex');
    expect(block).toContain('.oma-plx-tasks .oma-plx-listening-segment');
    expect(block).toContain('width: 100%');
    expect(block).toContain('min(260px, 84vw)');
    expect(block).toContain("[dir='rtl'] .oma-plx-tasks-panel .oma-kb-board__grid");
    expect(block).toContain('direction: rtl');
    expect(block).toContain('.oma-plx-tasks .oma-plx-deliv-table-wrap');
    expect(block).toContain('overflow-x: auto');
  });
});
