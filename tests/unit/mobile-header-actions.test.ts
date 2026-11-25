import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('mobile header actions', () => {
  it('keeps create icons in content and campaigns headers', () => {
    const content = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    const campaigns = read('apps/web/src/app/(app)/app/campaigns/page.tsx');
    expect(content).toContain('EditOutlined');
    expect(content).toContain('data-testid="demo-create-content"');
    expect(campaigns).toContain('OmaIconAction');
    expect(campaigns).toContain('PlusOutlined');
    expect(campaigns).toContain('data-testid="demo-create-campaign"');
  });

  it('keeps calendar controls as visible cards and makes campaign filters full height', () => {
    const cascade = read('apps/web/src/styles/oma-mobile-cascade-final.css');
    const density = read('apps/web/src/styles/mobile-density.css');
    expect(cascade).toContain('oma-cal-request-approvals');
    expect(cascade).toContain('oma-pv-icon-btn');
    expect(density).toContain('height: var(--oma-mobile-vh) !important');
    expect(cascade).toContain('overflow-y: auto !important');
  });
});
