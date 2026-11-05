import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('brand navigation mobile layout', () => {
  it('keeps brand tabs in one horizontally scrollable row on phones', () => {
    const shell = read('apps/web/src/components/brand/brand-workspace-shell.tsx');
    const css = read('apps/web/src/app/globals.css');
    const plxStyles = read('apps/web/src/styles/inbox-listening.css');
    const mobileRules = css.slice(css.lastIndexOf('Brand workspace navigation:'));

    expect(shell).toContain('className="oma-plx-deliv-groups oma-plx-brand-nav oma-brand-nav"');
    expect(shell).toContain('oma-plx-brand-nav-head');
    expect(mobileRules).toContain('@media (max-width: 767px)');
    expect(mobileRules).toContain('.oma-brand-nav:not(.oma-plx-brand-nav)');
    expect(mobileRules).toContain('.oma-plx-brand-nav-head');
    expect(mobileRules).toContain('overflow-x: auto !important');
    expect(mobileRules).toContain('touch-action: pan-x !important');
    expect(mobileRules).toContain('overscroll-behavior-inline: contain !important');
    expect(mobileRules).toContain('.oma-plx-brand-nav.oma-brand-nav');
    expect(mobileRules).toContain('min-width: max-content !important');
    expect(mobileRules).toContain('overflow: visible !important');
    expect(mobileRules).toContain('white-space: nowrap !important');
    expect(mobileRules).toContain('scroll-snap-type: x proximity');
    expect(plxStyles).toContain('.oma-plx-brand-nav-head {');
    expect(plxStyles).toContain('overflow-x: auto;');
    expect(plxStyles).toContain('.oma-plx-brand-nav {');
    expect(plxStyles).toContain('flex-wrap: nowrap;');
    expect(plxStyles).toContain('white-space: nowrap;');
  });
});
