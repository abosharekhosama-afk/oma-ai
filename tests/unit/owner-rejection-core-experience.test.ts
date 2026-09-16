import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHELL_NAV_SECTIONS } from '../../apps/web/src/components/shell/nav-config';
import {
  BOARD_COLUMNS,
  canTransitionTaskStatus,
  groupTasksByBoard,
  type TaskRow,
} from '../../apps/web/src/lib/demo/stage4-tasks';

describe('Owner rejection — Tasks IA + Kanban core', () => {
  it('exposes Tasks board in shell navigation', () => {
    const hrefs = SHELL_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain('/app/tasks');
    const tasks = SHELL_NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === '/app/tasks');
    expect(tasks?.labelKey).toBe('nav.tasks');
  });

  it('defaults board columns and maps OVERDUE into In Progress', () => {
    expect(BOARD_COLUMNS[0]?.id).toBe('BACKLOG');
    expect(BOARD_COLUMNS.find((c) => c.id === 'IN_PROGRESS')?.statuses).toContain('OVERDUE');
    const rows = [
      { id: 'a', status: 'READY' },
      { id: 'b', status: 'OVERDUE' },
    ] as TaskRow[];
    const board = groupTasksByBoard(rows);
    expect(board.READY?.map((t) => t.id)).toEqual(['a']);
    expect(board.IN_PROGRESS?.map((t) => t.id)).toEqual(['b']);
  });

  it('enforces valid/invalid status transitions', () => {
    expect(canTransitionTaskStatus('READY', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionTaskStatus('DONE', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionTaskStatus('DONE', 'BACKLOG')).toBe(true);
  });

  it('uses Planable system-UI tokens and ships kanban board component', () => {
    const tokens = readFileSync(join(process.cwd(), 'packages/ui/src/tokens.css'), 'utf8');
    expect(tokens).toContain('-apple-system');
    expect(tokens).toContain("'Noto Sans Arabic'");
    expect(tokens).not.toContain("'IBM Plex Sans'");
    expect(tokens).not.toContain("'Inter'");
    const layout = readFileSync(join(process.cwd(), 'apps/web/src/app/layout.tsx'), 'utf8');
    expect(layout).not.toMatch(/\bInter\b/);
    expect(layout).toContain('Noto_Sans_Arabic');
    expect(layout).not.toContain('IBM_Plex');
    expect(layout).toContain('planable-system');
    const board = readFileSync(
      join(process.cwd(), 'apps/web/src/components/demo/tasks-kanban-board.tsx'),
      'utf8',
    );
    expect(board).toContain('@dnd-kit/core');
    expect(board).toContain('data-testid="demo-tasks-board"');
    expect(board).toContain('KeyboardSensor');
  });

  it('records motion + reduced-motion rules', () => {
    const motion = readFileSync(join(process.cwd(), 'packages/ui/src/motion.css'), 'utf8');
    expect(motion).toContain('prefers-reduced-motion');
    expect(motion).toContain('oma-kanban-card.is-dragging');
  });
});
