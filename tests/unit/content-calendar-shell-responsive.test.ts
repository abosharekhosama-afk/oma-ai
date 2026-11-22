import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('content calendar shell responsiveness', () => {
  const client = readFileSync(
    resolve('apps/web/src/app/(app)/app/content/content-client.tsx'),
    'utf8',
  );
  const styles = readFileSync(resolve('apps/web/src/app/globals.css'), 'utf8');

  it('anchors the view menu to the visible breadcrumb and tracks rail, viewport, scroll, and RTL', () => {
    expect(client).toContain("document.getElementById('oma-content-view-slot')");
    expect(client).toContain('anchor.getBoundingClientRect()');
    expect(client).toContain("window.addEventListener('scroll', reposition, true)");
    expect(client).toContain('new ResizeObserver(reposition)');
    expect(client).toContain("attributeFilter: ['data-rail', 'dir']");
    expect(client).toContain('getComputedStyle(anchor).direction');
    expect(client).toContain('window.visualViewport?.addEventListener');
    expect(client).toContain("style={viewMenuPosition ?? { visibility: 'hidden' }}");
  });

  it('keeps the calendar toolbar in content flow and reserves room for two month cards', () => {
    expect(styles).toMatch(/\.oma-cal-toolbar\s*\{[^}]*position:\s*relative !important/s);
    expect(styles).toMatch(/\.oma-cal-toolbar\s*\{[^}]*width:\s*100% !important/s);
    expect(styles).toContain('grid-auto-rows: minmax(260px, auto) !important');
    expect(styles).toContain('grid-auto-rows: minmax(220px, auto) !important');
    expect(styles).toContain(".oma-cal-grid[data-span='week'] > .oma-cal-cell");
    expect(styles).toContain('min-block-size: 220px !important');
    expect(styles).toContain('min-block-size: 200px !important');
    expect(styles).toContain(".oma-cal-grid[data-span='month'] > .oma-cal-cell");
  });

  it('keeps the breadcrumb on one shrinkable line and gives filter sections safe gutters', () => {
    expect(styles).toContain('flex-wrap: nowrap !important');
    expect(styles).toContain('text-overflow: ellipsis !important');
    expect(styles).toContain('.oma-plx-content-filter-drawer .oma-filter-sidepanel__body');
    expect(styles).toContain('padding: 8px 16px 16px !important');
    expect(styles).toContain('.oma-plx-content-filter-drawer .oma-content-filter-eyebrow');
  });
});
