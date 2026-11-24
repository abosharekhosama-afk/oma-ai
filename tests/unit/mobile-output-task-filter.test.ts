import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readStage4Styles } from '../helpers/stage-styles';

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
    const iconCss = read('apps/web/src/styles/oma-icon-action.css');
    const plx = read('apps/web/src/components/ui/plx-header-filter.tsx');
    const deliverables = read('apps/web/src/app/(app)/app/deliverables/deliverables-client.tsx');
    const tasks = read('apps/web/src/app/(app)/app/tasks/tasks-client.tsx');

    expect(iconCss).toContain('.oma-icon-action');
    expect(plx).toContain('OmaIconAction');
    expect(plx).not.toContain('oma-req-filter-btn__label');
    expect(deliverables).toContain("locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter'");
    expect(tasks).toContain("locale.toLowerCase().startsWith('ar') ? 'تصفية' : 'Filter'");
    expect(deliverables).toContain('filterTestId="demo-deliv-open-filters"');
    expect(tasks).toContain('filterTestId="demo-task-open-filters"');
  });
});
