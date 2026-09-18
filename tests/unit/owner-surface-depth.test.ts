import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMPTY_DELIVERABLE_FILTERS } from '../../apps/web/src/lib/demo/stage5-deliverables';

describe('Owner surface-depth rebuild', () => {
  it('ships specialized depth CSS archetypes across Planable stage sheets', () => {
    const depth = readFileSync(join(process.cwd(), 'apps/web/src/styles/stage-depth.css'), 'utf8');
    const stage3 = readFileSync(join(process.cwd(), 'apps/web/src/styles/stage3.css'), 'utf8');
    const stage6 = readFileSync(join(process.cwd(), 'apps/web/src/styles/stage6.css'), 'utf8');
    expect(depth).toContain('.oma-doc-canvas');
    expect(depth).toContain('.oma-review-queue-cards');
    expect(depth).toContain('.oma-content-composer');
    // Campaign portfolio lives in Stage 3 Planable ownership (DEC-017 P3).
    expect(stage3).toContain('.oma-campaign-portfolio');
    // Analytics chart-first layout is Stage 6 Planable ownership (DEC-017 P6).
    expect(stage6).toContain('.oma-analytics-layout');
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
    expect(campaigns).toContain("useState<CampaignLayout>('portfolio')");
    const strategy = readFileSync(
      join(
        process.cwd(),
        'apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/edit/page.tsx',
      ),
      'utf8',
    );
    expect(strategy).toContain('strategy-document-canvas');
  });

  it('uses distinct local demo posters under Planable tokens (DEC-017)', () => {
    const poster = readFileSync(
      join(process.cwd(), 'apps/web/public/demo/poster-static.svg'),
      'utf8',
    );
    // Supersedes pre-DEC-017 "Quiet craft" copy — P3/P5 Planable fixture language.
    expect(poster).toContain('Back-to-work layers');
    expect(poster).toContain('#F5F6F7');
    expect(poster).toContain('#1677FF');
    expect(poster).toContain('system-ui');
    expect(poster).not.toContain('Quiet craft');
    expect(poster).not.toContain('planable');
    expect(poster).not.toContain('linear.app');
    expect(poster).not.toMatch(/#6658|#121419/i);
  });
});
