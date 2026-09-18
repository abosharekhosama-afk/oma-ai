import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('P3 Planable campaign/content surfaces', () => {
  it('rebuilds campaign portfolio without giant cards, tables, or signal aliases', () => {
    const page = read('apps/web/src/app/(app)/app/campaigns/page.tsx');
    const css = read('apps/web/src/styles/stage3.css');
    const depth = read('apps/web/src/styles/stage-depth.css');
    expect(page).toContain('demo-campaign-portfolio');
    expect(page).toContain('TrackPill');
    expect(page).toContain('<Dialog');
    expect(page).toContain('demo.create.brand');
    expect(page).not.toContain('oma-track-organic');
    expect(page).not.toContain('<table');
    expect(css).not.toContain('--oma-signal');
    expect(css).not.toContain('#6658');
    expect(css).toContain('.oma-content-feed');
    expect(css).toContain('.oma-cal-date-strip');
    expect(depth).not.toContain('--oma-signal');
    expect(depth).not.toContain('.oma-campaign-portfolio');
  });

  it('exposes Calendar Feed Grid List as distinct views on the same records', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(client).toContain("'calendar', 'feed', 'grid', 'list'");
    expect(client).toContain('demo-content-feed');
    expect(client).toContain('demo-content-grid');
    expect(client).toContain('demo-content-list');
    expect(client).toContain('demo-content-calendar');
    expect(client).toContain('demo-content-agenda');
    expect(client).toContain('demo-content-date-strip');
    expect(client).toContain('writeContentViewPref');
    expect(client).not.toContain('oma-track-paid');
  });

  it('opens composer/detail with comments and campaign deep links', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(client).toContain('demo-content-comments');
    expect(client).toContain('demo-content-composer');
    expect(client).toContain('demo-content-campaign-link');
    expect(client).toContain('demo.content.aiNotConnected');
    expect(client).toContain('<Drawer');
    expect(client).toContain('demo-create-content-dialog');
  });

  it('keeps campaign workspace linked to strategy without a metric-card wall', () => {
    const workspace = read('apps/web/src/app/(app)/app/campaigns/[campaignId]/page.tsx');
    expect(workspace).toContain('demo-campaign-strategy-link');
    expect(workspace).toContain('oma-status-rows');
    expect(workspace).not.toContain('oma-stage-trail');
    expect(workspace).not.toContain('oma-track-organic');
  });

  it('replaces P3 demo SVGs with light Planable-adjacent originals and leaves P5 assets', () => {
    const dir = join(root, 'apps/web/public/demo');
    const p3 = [
      'poster-static.svg',
      'poster-carousel-1.svg',
      'poster-carousel-2.svg',
      'video-poster.svg',
      'poster-story.svg',
      'poster-product.svg',
      'poster-campaign-banner.svg',
      'poster-ar.svg',
    ];
    for (const file of p3) {
      const svg = readFileSync(join(dir, file), 'utf8');
      expect(svg).not.toMatch(/#6658e8|#121419|#0f1117|#14151a|#1f2230/i);
      expect(svg).toMatch(/#F5F6F7|#FFFFFF/i);
    }
    const files = readdirSync(dir);
    expect(files.some((f) => f.startsWith('stage5-'))).toBe(true);
  });

  it('documents remaining P1_COMPAT aliases after P3 signal removal', () => {
    const inventory = read('docs/PLANABLE_P1_COMPAT_INVENTORY.md');
    const stage3 = read('apps/web/src/styles/stage3.css');
    expect(stage3).not.toContain('--oma-signal');
    expect(inventory).toMatch(/P6|CLOSED|Deleted/);
  });
});
