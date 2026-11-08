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
    expect(css).toContain('overflow-x: auto !important');
    expect(css).toContain('width: 233.333% !important');
    expect(css).toContain('min-width: 233.333% !important');
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
    expect(css).toContain('overflow-x: auto !important');
    expect(css).toContain('overflow-y: auto !important');
    expect(css).toContain('.oma-sched-day__scroll');
  });

  it('fills the mobile Schedule content width without changing shared density or local scrolling', () => {
    const css = read('apps/web/src/styles/inbox-listening.css');
    const density = read('apps/web/src/styles/mobile-density.css');
    const scheduleRule = css.slice(css.lastIndexOf('/* Mobile Schedule:'));

    expect(scheduleRule).toContain('@media (max-width: 767px)');
    expect(scheduleRule).toContain('.oma-plx-schedule');
    expect(density).toContain('--oma-mobile-density: 0.7');
    expect(density).toContain('zoom: var(--oma-mobile-density)');
  });

  it('makes the schedule layout a flex column so the calendar fills remaining height', () => {
    const css = read('apps/web/src/styles/stage5.css');
    expect(css).toContain('.oma-sched-layout {');
    expect(css).toContain('.oma-sched-layout--full');
    expect(css).toContain('display: flex !important');
    expect(css).toContain('flex-direction: column !important');
  });

  it('keeps calendar day columns height-constrained so posts scroll inside columns', () => {
    const css = read('apps/web/src/styles/stage5.css');
    expect(css).toContain('display: flex');
    expect(css).toContain('flex-direction: column');
    expect(css).toContain(".oma-sched-main[data-view='calendar'] .oma-sched-day__scroll");
    expect(css).toContain('overflow-y: auto !important');
    expect(css).toContain('min-height: 0 !important');
  });

  it('removes legacy schedule filter rail motion', () => {
    const css = read('apps/web/src/styles/side-drawers.css');
    expect(css).toContain('.oma-tasks-filter-drawer .ant-drawer-content-wrapper');
    expect(css).toContain('transition: none !important');
  });

  it('keeps the filter drawer and page within the mobile viewport', () => {
    const css = read('apps/web/src/styles/stage5.css');
    expect(css).toContain('.oma-sched-page');
    expect(css).toContain('overflow-x: hidden');
    expect(css).not.toContain('html,\n  body {\n    max-width: 100%');
    expect(css).toContain('.oma-tasks-filter-drawer .ant-drawer-content-wrapper');
    expect(css).toContain('max-width: 100vw !important');
  });

  it('uses the plx header filter popover instead of the legacy schedule filter drawer', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    expect(source).toContain('PlxHeaderFilter');
    expect(source).toContain("data-filter-open={filterSheet ? 'true' : 'false'}");
    expect(source).not.toContain('rootClassName="oma-tasks-filter-drawer"');
  });

  it('opens schedule details in a centered plx modal card (not a side drawer)', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    const css = read('apps/web/src/styles/inbox-listening.css');
    expect(source).toContain('className="oma-schedule-detail-modal"');
    expect(source).toContain('data-testid="demo-schedule-drawer"');
    expect(source).not.toContain('rootClassName="oma-schedule-detail-drawer"');
    expect(css).toContain('.oma-schedule-detail-modal');
    expect(css).toContain('.oma-plx-sched-detail-card');
  });

  it('keeps every schedule view at full mobile width and scrolls the calendar inside its container', () => {
    const css = read('apps/web/src/styles/inbox-listening.css');
    const stage = read('apps/web/src/styles/stage5.css');
    const scheduleRule = css.slice(css.lastIndexOf('/* Mobile Schedule:'));
    expect(scheduleRule).toContain('@media (max-width: 767px)');
    expect(scheduleRule).toContain('.oma-plx-listening.oma-plx-schedule');
    expect(scheduleRule).toContain('width: 100% !important');
    expect(scheduleRule).toContain('max-width: 100% !important');
    expect(scheduleRule).toContain('overflow-x: hidden');
    expect(scheduleRule).toContain(".oma-sched-main[data-view='calendar']");
    expect(scheduleRule).toContain(".oma-sched-main[data-view='agenda']");
    expect(scheduleRule).toContain(".oma-sched-main[data-view='queue']");
    expect(scheduleRule).toContain(".oma-sched-main[data-view='table']");
    expect(scheduleRule).toContain('.oma-sched-calendar-scroll');
    expect(scheduleRule).toContain('overflow-x: auto !important');
    expect(stage).toContain('.oma-sched-page');
    expect(stage).toContain('overflow-x: hidden !important');
    expect(stage).toContain('width: 233.333% !important');
    expect(stage).toContain('min-width: 233.333% !important');
  });

  it('sizes the schedule details card as a responsive sheet on mobile and a larger dialog on desktop', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    const css = read('apps/web/src/styles/inbox-listening.css');
    expect(source).toContain('rootClassName="oma-schedule-detail-modal-root"');
    expect(source).toContain('width="min(920px, calc(100vw - 32px))"');
    expect(source).not.toContain('width={560}');
    expect(css).toContain('.oma-schedule-detail-modal-root');
    expect(css).toContain('min(920px, calc(100vw - 32px))');
    expect(css).toContain('min(760px, calc(100vw - 40px))');
    expect(css).toContain('var(--oma-mobile-vw, 100vw)');
    expect(css).toContain('var(--oma-mobile-vh, 100dvh)');
    expect(css).toContain('border-start-start-radius: 16px');
    expect(css).toContain('border-start-end-radius: 16px');
    expect(css).toContain('inset-inline: 0');
    expect(css).toContain('overflow-y: auto');
  });

  it('anchors schedule view switching in the workspace header popover', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    expect(source).toContain('data-testid="demo-schedule-view-toggle"');
    expect(source).toContain('data-testid={`demo-schedule-view-${id}`}');
    expect(source).not.toContain('oma-plx-sched-view-segment');
  });
});
