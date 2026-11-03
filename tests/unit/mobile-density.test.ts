import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('mobile 70% viewport scale', () => {
  it('loads the mobile density layer and uses viewport meta scale (not CSS zoom)', () => {
    const globals = read('apps/web/src/app/globals.css');
    expect(globals).toContain("@import '../styles/mobile-density.css';");
    expect(globals).toContain('Mobile scale fill');
    expect(globals).not.toContain('height: calc(100dvh / var(--oma-mobile-density)) !important');
  });

  it('sets phone viewport to 70% via early layout script and avoids zoom/transform scale', () => {
    const layout = read('apps/web/src/app/layout.tsx');
    const css = read('apps/web/src/styles/mobile-density.css');
    expect(layout).toContain('var SCALE=0.7');
    expect(layout).toContain('initial-scale=');
    expect(layout).toContain('MOBILE_VIEWPORT_SCALE_SCRIPT');
    expect(css).toContain('--oma-mobile-density: 0.7');
    expect(css).not.toContain('zoom:');
    expect(css).not.toContain('transform: scale');
    expect(css).toContain('font-size: 16px !important');
    expect(css).toContain('overflow-x: hidden !important');
  });
});
