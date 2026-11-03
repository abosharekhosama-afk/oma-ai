import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('mobile 70% CSS zoom scale', () => {
  it('loads the mobile density layer with zoom compensation (not viewport meta scale)', () => {
    const globals = read('apps/web/src/app/globals.css');
    expect(globals).toContain("@import '../styles/mobile-density.css';");
    expect(globals).toContain('Mobile zoom fill');
    expect(globals).toContain('height: calc(100dvh / var(--oma-mobile-density)) !important');
  });

  it('applies zoom 0.7 on html under mobile media and restores default viewport meta', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    const css = read('apps/web/src/styles/mobile-density.css');
    expect(layout).not.toContain('MOBILE_VIEWPORT_SCALE_SCRIPT');
    expect(layout).not.toContain('initial-scale=');
    expect(layout).toContain("width: 'device-width'");
    expect(layout).toContain('initialScale: 1');
    expect(css).toContain('--oma-mobile-density: 0.7');
    expect(css).toContain('zoom: var(--oma-mobile-density)');
    expect(css).toContain('--oma-mobile-vw: calc(100vw / var(--oma-mobile-density))');
    expect(css).toContain('--oma-mobile-vh: calc(100dvh / var(--oma-mobile-density))');
    expect(css).not.toContain('transform: scale');
    expect(css).toContain('font-size: 16px !important');
  });
});
