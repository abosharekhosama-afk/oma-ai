import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('mobile native-scale layout', () => {
  it('loads the mobile density layer without CSS zoom', () => {
    const globals = read('apps/web/src/app/globals.css');
    expect(globals).toContain("@import '../styles/mobile-density.css';");
    expect(globals).toContain('Mobile shell fill');
    expect(globals).toContain('var(--oma-mobile-vh, 100dvh)');
  });

  it('uses device-width viewport meta and density 1 tokens', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    const css = read('apps/web/src/styles/mobile-density.css');
    expect(layout).not.toContain('MOBILE_VIEWPORT_SCALE_SCRIPT');
    expect(layout).toContain("width: 'device-width'");
    expect(layout).toContain('initialScale: 1');
    expect(css).toContain('--oma-mobile-density: 1');
    expect(css).not.toContain('zoom: var(--oma-mobile-density)');
    expect(css).toContain('--oma-mobile-vw: 100vw');
    expect(css).toContain('--oma-mobile-vh: 100dvh');
    expect(css).not.toContain('transform: scale');
    expect(css).toContain('font-size: 16px !important');
  });

  it('caps mobile drawers with readable widths', () => {
    const css = read('apps/web/src/styles/mobile-density.css');
    expect(css).toContain('--oma-drawer-nav-width');
    expect(css).toContain('--oma-drawer-panel-width');
    expect(css).toContain('min(75vw, 280px)');
    expect(css).toContain('min(82vw, 320px)');
    expect(css).not.toMatch(
      /ant-drawer-content-wrapper[^{]*\{\s*width:\s*min\(100%,\s*var\(--oma-mobile-vw\)\)/s,
    );
  });
});
