import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  briefIsReady,
  filterRequests,
  EMPTY_REQUEST_FILTERS,
} from '../../apps/web/src/lib/demo/stage4-requests';
import {
  canTransitionTaskStatus,
  filterTasks,
  groupTasksByBoard,
  EMPTY_TASK_FILTERS,
} from '../../apps/web/src/lib/demo/stage4-tasks';
import { DEMO_GRAPH } from '../../packages/demo/src/index';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('P4 Planable requests/briefs/tasks surfaces', () => {
  it('rebuilds requests inbox without violet/signal contamination', () => {
    const page = read('apps/web/src/app/(app)/app/requests/page.tsx');
    const css = read('apps/web/src/styles/stage4.css');
    expect(page).toContain('demo-requests');
    expect(page).toContain('demo-request-table');
    expect(page).toContain('demo-create-request-dialog');
    expect(page).toContain('oma-req-avatar');
    expect(page).toContain('<Dialog');
    expect(css).not.toContain('--oma-violet');
    expect(css).not.toContain('--oma-signal');
    expect(css).not.toContain('#6658');
    expect(css).not.toContain('--motion-micro');
    expect(css).toContain('--oma-primary');
    expect(css).toContain('.oma-kanban');
    expect(css).toContain('.oma-brief-layout');
  });

  it('exposes structured brief canvas with TOC and ready gate', () => {
    const detail = read('apps/web/src/app/(app)/app/requests/[requestId]/page.tsx');
    expect(detail).toContain('demo-structured-brief');
    expect(detail).toContain('oma-brief-layout');
    expect(detail).toContain('oma-brief-toc');
    expect(detail).toContain('demo-brief-save');
    expect(detail).toContain('demo-request-convert');
    expect(detail).toContain('demo-brief-ai-honesty');
  });

  it('keeps professional kanban with dnd-kit and a11y fallback', () => {
    const board = read('apps/web/src/components/demo/tasks-kanban-board.tsx');
    const tasks = read('apps/web/src/app/(app)/app/tasks/tasks-client.tsx');
    expect(board).toContain('@dnd-kit/core');
    expect(board).toContain('demo-tasks-board');
    expect(board).toContain('demo-kanban-drag-overlay');
    expect(board).toContain('demo-task-move-');
    expect(board).toContain('oma-task-avatar');
    expect(tasks).toContain('demo-tasks-view-board');
    expect(tasks).toContain('demo-task-drawer');
    expect(tasks).toContain('<Drawer');
  });

  it('filters requests and groups tasks without inventing statuses', () => {
    const filtered = filterRequests(
      DEMO_GRAPH.requests,
      { ...EMPTY_REQUEST_FILTERS, group: 'untriaged' },
      'en',
    );
    expect(filtered.every((r) => r.status === 'OPEN' && !r.assignee)).toBe(true);
    const tasks = filterTasks(DEMO_GRAPH.tasks, EMPTY_TASK_FILTERS, 'en');
    const board = groupTasksByBoard(tasks);
    expect(Object.keys(board)).toEqual([
      'BACKLOG',
      'READY',
      'IN_PROGRESS',
      'IN_REVIEW',
      'BLOCKED',
      'DONE',
    ]);
  });

  it('rejects invalid task transitions and keeps brief readiness honest', () => {
    expect(canTransitionTaskStatus('DONE', 'IN_PROGRESS')).toBe(false);
    expect(canTransitionTaskStatus('READY', 'IN_PROGRESS')).toBe(true);
    const brief = DEMO_GRAPH.briefs[0]!;
    expect(typeof briefIsReady(brief)).toBe('boolean');
  });

  it('documents within-column reorder as local-only in board code', () => {
    const board = read('apps/web/src/components/demo/tasks-kanban-board.tsx');
    // Cross-column calls onMoveTask; same-column arrayMove stays local.
    expect(board).toContain('arrayMove');
    expect(board).toContain('await onMoveTask(taskId, targetStatus)');
    expect(board).toContain('data-reorder-persistence="local-only"');
  });
});
