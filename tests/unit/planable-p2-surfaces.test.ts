import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brandAttention, isBrandNeedingAction } from '../../apps/web/src/lib/brand-attention';
import { filterDiscoveryPages } from '../../apps/web/src/lib/discovery-filter';
import type { BrandListItem } from '../../apps/web/src/lib/brand-types';

function fixture(over: Partial<BrandListItem> = {}): BrandListItem {
  return {
    id: 'b1',
    name: 'Horizon',
    status: 'ACTIVE',
    primary_website_url: 'https://example.com',
    current_approved_profile_version_id: null,
    latest_scan_status: 'PARTIAL',
    latest_scan_id: 's1',
    latest_profile_status: 'NEEDS_REVIEW',
    latest_profile_version_id: 'p1',
    updated_at: '2026-09-16T00:00:00.000Z',
    ...over,
  };
}

describe('P2 Planable brand/strategy surfaces', () => {
  it('maps brand item states to actionable attention', () => {
    expect(brandAttention(fixture({ primary_website_url: null }))).toBe('connect_website');
    expect(
      brandAttention(fixture({ latest_scan_status: null, primary_website_url: 'https://x.com' })),
    ).toBe('start_scan');
    expect(brandAttention(fixture())).toBe('review_partial');
    expect(brandAttention(fixture({ latest_scan_status: 'SUCCEEDED' }))).toBe('review_profile');
    expect(
      brandAttention(
        fixture({
          current_approved_profile_version_id: 'pv1',
          latest_scan_status: 'SUCCEEDED',
          latest_profile_status: 'APPROVED',
        }),
      ),
    ).toBe('open_approved');
    expect(isBrandNeedingAction(fixture())).toBe(true);
    expect(
      isBrandNeedingAction(
        fixture({
          current_approved_profile_version_id: 'pv1',
          latest_scan_status: 'SUCCEEDED',
          latest_profile_status: 'APPROVED',
        }),
      ),
    ).toBe(false);
  });

  it('filters discovery pages by query, classification, status, and evidence', () => {
    const pages = [
      {
        id: 'p1',
        title: 'Home',
        url: 'https://ex.com/',
        classification: 'HOME',
        fetch_status: 'FETCHED',
      },
      {
        id: 'p2',
        title: 'Pricing',
        url: 'https://ex.com/pricing',
        classification: 'OTHER',
        fetch_status: 'FAILED',
      },
    ];
    expect(filterDiscoveryPages(pages, { query: 'pricing' })).toEqual([pages[1]]);
    expect(filterDiscoveryPages(pages, { classification: 'HOME' })).toEqual([pages[0]]);
    expect(filterDiscoveryPages(pages, { fetchStatus: 'FAILED' })).toEqual([pages[1]]);
    expect(
      filterDiscoveryPages(pages, { evidenceOnly: true, evidenceByPage: { p1: 'e1' } }),
    ).toEqual([pages[0]]);
  });

  it('rebuilds Command Center and portfolio without metric-card walls or violet CSS', () => {
    const home = readFileSync(join(process.cwd(), 'apps/web/src/app/(app)/app/page.tsx'), 'utf8');
    const brands = readFileSync(
      join(process.cwd(), 'apps/web/src/app/(app)/app/brands/page.tsx'),
      'utf8',
    );
    const stage2 = readFileSync(join(process.cwd(), 'apps/web/src/styles/stage2.css'), 'utf8');
    expect(home).toContain('command-center-workspaces');
    expect(home).toContain('demo-command-center');
    expect(home).not.toContain('home.demoPerformance');
    expect(brands).toContain('WorkspaceCard');
    expect(brands).toContain('oma-filter-bar');
    expect(stage2).not.toContain('--oma-signal');
    expect(stage2).not.toContain('#6658');
    expect(stage2).toContain('.oma-workspace-card');
  });

  it('uses Planable editor language for intelligence and strategy foundation', () => {
    const profile = readFileSync(
      join(process.cwd(), 'apps/web/src/components/brand/profile-sections.tsx'),
      'utf8',
    );
    const foundation = readFileSync(
      join(
        process.cwd(),
        'apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/edit/page.tsx',
      ),
      'utf8',
    );
    expect(profile).toContain('oma-editor-shell');
    expect(profile).toContain('brand-profile-completeness');
    expect(profile).not.toMatch(/Jasper/);
    expect(foundation).toContain('strategy-document-canvas');
    expect(foundation).toContain('oma-editor-shell');
  });

  it('presents Organic/Paid as labeled chips not color-only tracks', () => {
    const css = readFileSync(join(process.cwd(), 'apps/web/src/styles/stage2.css'), 'utf8');
    expect(css).toContain('.oma-track-pill--organic');
    expect(css).toContain('.oma-track-pill--paid');
    expect(css).toContain(".oma-track-pill[aria-current='page']");
    expect(css).not.toContain('var(--oma-signal)');
    const overview = readFileSync(
      join(
        process.cwd(),
        'apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/page.tsx',
      ),
      'utf8',
    );
    expect(overview).toContain("t('strategy.nav.organic')");
    expect(overview).toContain("t('strategy.nav.paid')");
    expect(overview).toContain('strategy-current-badge');
  });

  it('opens Create Brand through the P1 dialog primitive', () => {
    const create = readFileSync(
      join(process.cwd(), 'apps/web/src/app/(app)/app/brands/new/page.tsx'),
      'utf8',
    );
    expect(create).toContain('<Dialog');
    expect(create).toContain('CreateBrandForm');
  });

  it('maps scan progress and keeps cancel/retry actions', () => {
    const scan = readFileSync(
      join(process.cwd(), 'apps/web/src/app/(app)/app/brands/[brandId]/scans/[scanId]/page.tsx'),
      'utf8',
    );
    expect(scan).toContain('oma-scan-phases');
    expect(scan).toContain('brand.scan.cancel');
    expect(scan).toContain('brand.scan.retry');
    expect(scan).toContain('progress_percent');
  });

  it('navigates evidence previous/next from the P1 drawer', () => {
    const panel = readFileSync(
      join(process.cwd(), 'apps/web/src/components/brand/evidence-side-panel.tsx'),
      'utf8',
    );
    expect(panel).toContain('<Drawer');
    expect(panel).toContain('ArrowLeft');
    expect(panel).toContain('brand.evidence.prev');
  });

  it('disables partial approval until incompleteness is acknowledged', () => {
    const approval = readFileSync(
      join(process.cwd(), 'apps/web/src/components/brand/approval-summary.tsx'),
      'utf8',
    );
    expect(approval).toContain('acknowledge_incomplete');
    expect(approval).toContain('isPartial && !ackIncomplete');
    expect(approval).toContain('approveBlocked');
    const profile = readFileSync(
      join(
        process.cwd(),
        'apps/web/src/app/(app)/app/brands/[brandId]/profiles/[versionId]/page.tsx',
      ),
      'utf8',
    );
    expect(profile).toContain('immutable-banner');
    expect(profile).toContain("profile?.status === 'DRAFT'");
  });

  it('gates strategy review when the approved Brand Profile is missing', () => {
    const review = readFileSync(
      join(
        process.cwd(),
        'apps/web/src/app/(app)/app/brands/[brandId]/strategies/[strategyId]/review/page.tsx',
      ),
      'utf8',
    );
    expect(review).toContain('strategy-missing-profile');
    expect(review).toContain('SubmitEligibility');
    expect(review).toContain('missingProfile');
  });

  it('removes P2 signal aliases from stage2 CSS while leaving later-stage aliases documented', () => {
    const inventory = readFileSync(
      join(process.cwd(), 'docs/PLANABLE_P1_COMPAT_INVENTORY.md'),
      'utf8',
    );
    const stage2 = readFileSync(join(process.cwd(), 'apps/web/src/styles/stage2.css'), 'utf8');
    expect(inventory).toContain('removed from stage2.css in P2');
    expect(stage2).not.toContain('--oma-violet');
    expect(stage2).not.toContain('--oma-signal');
  });
});
