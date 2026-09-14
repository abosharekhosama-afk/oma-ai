import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMPTY_DELIVERABLE_FILTERS } from '../../apps/web/src/lib/demo/stage5-deliverables';

describe('Owner surface-depth rebuild', () => {
  it('ships specialized depth CSS archetypes', () => {
    const css = readFileSync(join(process.cwd(), 'apps/web/src/styles/stage-depth.css'), 'utf8');
    expect(css).toContain('.oma-doc-canvas');
    expect(css).toContain('.oma-campaign-portfolio');
    expect(css).toContain('.oma-review-queue-cards');
    expect(css).toContain('.oma-analytics-layout');
    expect(css).toContain('.oma-content-composer');
    const globals = readFileSync(join(process.cwd(), 'apps/web/src/app/globals.css'), 'utf8');
    expect(globals).toContain('stage-depth.css');
  });

  it('defaults deliverables to asset grid', () => {
    expect(EMPTY_DELIVERABLE_FILTERS.view).toBe('grid');
  });

  it('rebuilds Brand Intelligence as outline canvas', () => {
    const src = readFileSync(
      join(process.cwd(), 'apps/web/src/components/brand/profile-sections.tsx'),
      'utf8',
    );
    expect(src).toContain('brand-intelligence-canvas');
    expect(src).toContain('oma-doc-outline');
    expect(src).toContain('brand-profile-completeness');
  });

  it('adds campaign portfolio and strategy document canvas', () => {
    const campaigns = readFileSync(
      join(process.cwd(), 'apps/web/src/app/(app)/app/campaigns/page.tsx'),
      'utf8',
    );
    expect(campaigns).toContain('demo-campaign-portfolio');
    expect(campaigns).toContain("useState<'portfolio' | 'table'>('portfolio')");
    const strategy = readFileSync(
      join(
        process.cwd(),
        'apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/edit/page.tsx',
      ),
      'utf8',
    );
    expect(strategy).toContain('strategy-document-canvas');
  });

  it('uses distinct local demo posters', () => {
    const poster = readFileSync(
      join(process.cwd(), 'apps/web/public/demo/poster-static.svg'),
      'utf8',
    );
    expect(poster).toContain('Quiet craft');
    expect(poster).not.toContain('planable');
    expect(poster).not.toContain('linear.app');
  });
});
