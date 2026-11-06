import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('mobile deliverables width and task/output filter actions', () => {
  it('expands the deliverables list surface with a small phone-only gutter', () => {
    const css = read('apps/web/src/styles/stage5.css');
    const mobileRules = css.slice(css.lastIndexOf('Phone-width deliverables:'));

    expect(mobileRules).toContain('@media (max-width: 767px)');
    expect(mobileRules).toContain('padding-inline: 6px !important');
    expect(mobileRules).toContain('padding: 6px 4px 18px !important');
    expect(mobileRules).toContain('.oma-deliv-mobile-card');
    expect(mobileRules).toContain('width: 100% !important');
  });

  it('makes only task and deliverables filter labels icon-only below the phone breakpoint', () => {
    const css = read('apps/web/src/styles/stage4.css');
    const mobileRules = css.slice(css.lastIndexOf('Phone headers: filter controls'));
    const deliverables = read('apps/web/src/app/(app)/app/deliverables/deliverables-client.tsx');
    const tasks = read('apps/web/src/app/(app)/app/tasks/tasks-client.tsx');

    expect(mobileRules).toContain('@media (max-width: 767px)');
    expect(mobileRules).toContain("data-testid='demo-deliv-open-filters'");
    expect(mobileRules).toContain("data-testid='demo-task-open-filters'");
    expect(mobileRules).toContain('> .oma-req-filter-btn__label');
    expect(mobileRules).toContain('display: none !important');
    expect(deliverables).toContain("locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter'");
    expect(tasks).toContain("locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter'");
    expect(deliverables).toContain('filterTestId="demo-deliv-open-filters"');
    expect(tasks).toContain('filterTestId="demo-task-open-filters"');
  });
});
