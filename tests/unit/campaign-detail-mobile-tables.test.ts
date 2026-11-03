import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('campaign detail mobile tables', () => {
  it('renders all linked campaign tabs with the shared table surface', () => {
    const page = read('apps/web/src/app/(app)/app/campaigns/[campaignId]/page.tsx');
    expect(page).toContain('oma-campaign-detail');
    expect(page).toContain('data-testid="demo-campaign-content-tab"');
    expect(page).toContain("tab === 'tasks'");
    expect(page).toContain("tab === 'deliverables'");
    expect(page).toContain("tab === 'activity'");
    expect(page).toContain('className="oma-req-table oma-task-table"');
  });

  it('keeps detail tables visible and scrollable on small screens', () => {
    const css = read('apps/web/src/styles/mobile-precise-nov03.css');
    expect(css).toContain('.oma-campaign-detail .oma-campaign-table');
    expect(css).toContain('display: block !important');
    expect(css).toContain('overflow-x: auto !important');
    expect(css).toContain('.oma-campaign-detail .oma-campaign-table > table');
    expect(css).toContain('display: table !important');
  });
});
