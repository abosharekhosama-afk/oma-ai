import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('brand navigation mobile layout', () => {
  it('shows all brand sections as wrapping mobile tabs without changing desktop rules', () => {
    const shell = read('apps/web/src/components/brand/brand-workspace-shell.tsx');
    const css = read('apps/web/src/app/globals.css');
    const mobileRules = css.slice(css.lastIndexOf('Brand workspace navigation:'));

    expect(shell).toContain('className="oma-brand-nav"');
    expect(mobileRules).toContain('@media (max-width: 767px)');
    expect(mobileRules).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important');
    expect(mobileRules).toContain('overflow: visible !important');
    expect(mobileRules).toContain('min-height: 44px !important');
    expect(mobileRules).toContain('white-space: normal !important');
    expect(mobileRules).toContain('@media (max-width: 360px)');
    expect(mobileRules).toContain('grid-template-columns: minmax(0, 1fr) !important');
  });
});
