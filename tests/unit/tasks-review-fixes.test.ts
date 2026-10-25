import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canSubmitForReview } from '../../apps/web/src/lib/demo/stage5-deliverables';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('tasks/review fixes', () => {
  it('filter panel is a full-height antd Drawer that flips side in RTL', () => {
    const src = read('apps/web/src/app/(app)/app/tasks/tasks-client.tsx');
    expect(src).toContain('<AntDrawer');
    expect(src).toContain("startsWith('ar') ? 'left' : 'right'");
    expect(src).not.toContain('oma-tasks-filter-bar');
  });

  it('related-record links never render raw ids', () => {
    for (const p of [
      'apps/web/src/app/(app)/app/tasks/tasks-client.tsx',
      'apps/web/src/app/(app)/app/requests/[requestId]/page.tsx',
      'apps/web/src/app/(app)/app/deliverables/[deliverableId]/deliverable-client.tsx',
    ]) {
      const src = read(p);
      expect(src).toContain('<EntityLink');
      expect(src).not.toMatch(
        />\s*\{(selected|row)\.(campaignId|contentId|requestId|taskId|deliverableId)\}\s*</,
      );
    }
  });

  it('task drawer uses the assignee picker card, not a select', () => {
    const src = read('apps/web/src/app/(app)/app/tasks/tasks-client.tsx');
    expect(src).toContain('<AssigneePicker');
    expect(src).not.toMatch(/<select[^>]*\n?[^>]*data-testid="demo-task-assignee"/);
  });

  it('submit for review matches the domain policy', () => {
    expect(canSubmitForReview('DRAFT')).toBe(true);
    expect(canSubmitForReview('NOT_STARTED')).toBe(true);
    expect(canSubmitForReview('CHANGES_REQUESTED')).toBe(true);
    expect(canSubmitForReview('AWAITING_REVIEW')).toBe(false);
    expect(canSubmitForReview('APPROVED')).toBe(false);
    expect(canSubmitForReview('REJECTED')).toBe(false);
  });
});
