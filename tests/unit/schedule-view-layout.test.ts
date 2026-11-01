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

  it('hides the compact mobile week list when agenda or queue already renders its own rows', () => {
    const source = read('apps/web/src/app/(app)/app/schedule/schedule-client.tsx');
    const css = read('apps/web/src/styles/stage5.css');
    expect(source).toContain('data-testid="demo-schedule-mobile"');
    expect(css).toContain(".oma-sched-main[data-view='agenda'] > .oma-sched-mobile-only");
    expect(css).toContain(".oma-sched-main[data-view='queue'] > .oma-sched-mobile-only");
    expect(css).toContain('display: none !important');
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
