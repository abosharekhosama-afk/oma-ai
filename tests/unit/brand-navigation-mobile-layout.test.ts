import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('brand navigation mobile layout', () => {
  it('keeps brand tabs in one horizontally scrollable row on phones', () => {
    const shell = read('apps/web/src/components/brand/brand-workspace-shell.tsx');
    const css = read('apps/web/src/app/globals.css');
    const mobileRules = css.slice(css.lastIndexOf('Brand workspace navigation:'));

    expect(shell).toContain('oma-brand-nav');
    expect(mobileRules).toContain('@media (max-width: 767px)');
    expect(mobileRules).toContain('flex-wrap: nowrap !important');
    expect(mobileRules).toContain('overflow-x: scroll !important');
    expect(mobileRules).toContain('width: 100% !important');
    expect(mobileRules).toContain('width: max-content !important');
    expect(mobileRules).toContain('touch-action: pan-x !important');
    expect(mobileRules).toContain('overscroll-behavior-inline: contain !important');
    expect(mobileRules).toContain('white-space: nowrap !important');
    expect(mobileRules).toContain('scroll-snap-type: x proximity');
    expect(mobileRules).not.toContain('grid-template-columns');
    expect(mobileRules).not.toContain('border-radius: var(--oma-radius-control) !important');
    expect(mobileRules).not.toContain('background: var(--oma-primary-soft) !important');
  });
});
