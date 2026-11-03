import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('brand detail mobile layout', () => {
  it('scopes narrow-screen overflow protection to the brand detail page', () => {
    const source = read('apps/web/src/app/(app)/app/brands/[brandId]/page.tsx');
    const css = read('apps/web/src/app/globals.css');
    const mobileRules = css.slice(css.lastIndexOf('Brand detail phone layout:'));

    expect(source).toContain('className="oma-workboard-split oma-brand-detail-workboard"');
    expect(mobileRules).toContain('@media (max-width: 767px)');
    expect(mobileRules).toContain('.oma-brand-detail-workboard');
    expect(mobileRules).toContain('grid-template-columns: minmax(0, 1fr) !important');
    expect(mobileRules).toContain('min-width: 0 !important');
    expect(mobileRules).toContain('overflow-wrap: anywhere !important');
    expect(mobileRules).toContain('white-space: normal !important');
  });
});
