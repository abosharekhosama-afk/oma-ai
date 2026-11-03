import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), 'utf8');
}

describe('mobile compact density', () => {
  it('loads the compact density layer after the other mobile cascades', () => {
    const globals = read('apps/web/src/app/globals.css');
    expect(globals.indexOf("@import '../styles/mobile-density.css';")).toBeGreaterThan(
      globals.indexOf("@import '../styles/mobile-precise-nov03.css';"),
    );
  });

  it('uses compact tokens without changing the viewport coordinate system', () => {
    const css = read('apps/web/src/styles/mobile-density.css');
    expect(css).toContain('--oma-mobile-density: 0.65');
    expect(css).toContain('font-size: 10.4px !important');
    expect(css).toContain('min-height: 40px !important');
    expect(css).toContain('font-size: 16px !important');
    expect(css).not.toContain('zoom:');
  });
});
