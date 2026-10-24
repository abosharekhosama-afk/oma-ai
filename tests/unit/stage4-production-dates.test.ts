import { describe, expect, it } from 'vitest';
import { addDays, todayKey } from '../../apps/web/src/lib/calendar-today';
import { requestIsOverdue } from '../../apps/web/src/lib/demo/stage4-requests';
import { taskIsOverdue, productionSummary } from '../../apps/web/src/lib/demo/stage4-tasks';

describe('production date helpers (stage4)', () => {
  const today = todayKey();

  it('requestIsOverdue uses rolling today', () => {
    const row = {
      status: 'OPEN',
      dueAt: addDays(today, -1),
    } as Parameters<typeof requestIsOverdue>[0];
    expect(requestIsOverdue(row, today)).toBe(true);
  });

  it('taskIsOverdue respects DONE', () => {
    const row = {
      status: 'DONE',
      dueAt: addDays(today, -3),
    } as Parameters<typeof taskIsOverdue>[0];
    expect(taskIsOverdue(row, today)).toBe(false);
  });

  it('productionSummary dueSoon counts within 7 days', () => {
    const tasks = [
      { status: 'IN_PROGRESS', dueAt: addDays(today, 3) },
      { status: 'IN_PROGRESS', dueAt: addDays(today, 30) },
      { status: 'DONE', dueAt: addDays(today, 1) },
    ] as Parameters<typeof productionSummary>[0];
    const summary = productionSummary(tasks, today);
    expect(summary.dueSoon).toBe(1);
  });
});
