import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('schedule agenda and queue layouts', () => {
  it('renders agenda and queue with a stable chronological order and explicit view state', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    expect(source).toContain('const orderedRows = useMemo(');
    expect(source).toContain('a.plannedAt.localeCompare(b.plannedAt)');
    expect(source).toContain('data-view={view}');
    expect(source).toContain('orderedRows.map((post) => {');
  });

  it('adds a table view with the key scheduling columns', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    const schedule = read('apps/web/src/lib/demo/stage6-schedule.ts');
    expect(schedule).toContain("'table'");
    expect(source).toContain("['table'");
    expect(source).toContain('data-testid="demo-schedule-table"');
    expect(source).toContain('data-testid={`demo-schedule-table-row-${post.id}`}');
    expect(source).toContain("locale.startsWith('ar') ? 'التاريخ والوقت' : 'Date & time'");
  });

  it('provides independent vertical scrolling for both non-calendar views', () => {
    const css = read('apps/web/src/styles/stage5.css');
    const fix = css.slice(css.lastIndexOf('Agenda and queue are distinct'));
    expect(fix).toContain(".oma-sched-main[data-view='agenda']");
    expect(fix).toContain(".oma-sched-main[data-view='queue']");
    expect(fix).toContain('overflow-y: auto !important');
    expect(fix).toContain('overscroll-behavior-y: contain');
    expect(fix).toContain('scrollbar-gutter: stable');
  });

  it('uses a timeline for agenda and a responsive card grid for queue', () => {
    const css = read('apps/web/src/styles/stage5.css');
    const fix = css.slice(css.lastIndexOf('Agenda and queue are distinct'));
    expect(fix).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(fix).toContain('border-inline-start: 3px solid');
    expect(fix).toContain('repeat(auto-fit, minmax(min(100%, 350px), 1fr))');
    expect(fix).toContain('@media (max-width: 900px)');
    expect(fix).toContain('grid-template-columns: minmax(0, 1fr)');
  });

  it('removes the duplicate mobile card list and keeps the calendar horizontally scrollable', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    const css = read('apps/web/src/styles/stage5.css');
    expect(source).not.toContain('data-testid="demo-schedule-mobile"');
    expect(css).toContain(".oma-sched-main[data-view='agenda'] > .oma-sched-mobile-only");
    expect(css).toContain(".oma-sched-main[data-view='queue'] > .oma-sched-mobile-only");
    expect(css).toContain('display: none !important');
    expect(css).toContain(".oma-sched-main[data-view='calendar']");
    expect(css).toContain('overflow-x: scroll !important');
    expect(css).toContain('--oma-sched-mobile-calendar-column');
    expect(css).toContain('233.333333vw');
  });

  it('does not hide the calendar with the legacy mobile display rule', () => {
    const css = read('apps/web/src/styles/stage5.css');
    expect(css).not.toMatch(
      /\.oma-sched-calendar,\s*\.oma-sched-week,\s*\.oma-sched-dow-row\s*\{\s*display:\s*none\s*;\s*\}/,
    );
    expect(css).toContain(".oma-sched-main[data-view='calendar'] .oma-sched-calendar");
    expect(css).toContain('display: flex !important');
  });

  it('keeps the mobile app viewport at device width', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    expect(layout).toContain("import type { Metadata, Viewport } from 'next'");
    expect(layout).toContain("width: 'device-width'");
    expect(layout).toContain('initialScale: 1');
  });

  it('uses a dedicated horizontal scroll surface for the calendar', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    const css = read('apps/web/src/styles/stage5.css');
    expect(source).toContain('demo-schedule-calendar-scroll');
    expect(css).toContain('.oma-sched-calendar-scroll');
    expect(css).toContain('touch-action: pan-x pan-y');
  });

  it('keeps the filter drawer and page within the mobile viewport', () => {
    const css = read('apps/web/src/styles/stage5.css');
    expect(css).toContain('html,\n  body');
    expect(css).toContain('overflow-x: hidden !important');
    expect(css).toContain('.oma-tasks-filter-drawer .ant-drawer-content-wrapper');
    expect(css).toContain('max-width: 100vw !important');
  });

  it('removes the legacy inline filter rail and destroys the drawer after closing', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    expect(source).toContain('destroyOnHidden');
    expect(source).not.toContain("data-filter-open={filterSheet ? 'true' : 'false'}");
  });

  it('uses the shared side-drawer treatment for schedule details', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    const css = read('apps/web/src/styles/side-drawers.css');
    expect(source).toContain(
      "placement={locale.toLowerCase().startsWith('ar') ? 'left' : 'right'}",
    );
    expect(source).toContain('rootClassName="oma-schedule-detail-drawer"');
    expect(css).toContain('.oma-schedule-detail-drawer .ant-drawer-content-wrapper');
    expect(css).toContain('.oma-schedule-detail-drawer .oma-plx-sched-drawer');
    expect(css).toContain('backdrop-filter: blur(8px)');
  });
});
