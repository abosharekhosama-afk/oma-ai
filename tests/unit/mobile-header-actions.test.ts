import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('mobile header actions', () => {
  it('keeps create icons in content and campaigns headers', () => {
    const content = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    const campaigns = read('apps/web/src/app/(app)/app/campaigns/page.tsx');
    expect(content).toContain('<EditOutlined />');
    expect(content).toContain('data-testid="demo-create-content"');
    expect(campaigns).toContain('className="oma-req-create-button"');
    expect(campaigns).toContain('<PlusOutlined />');
    expect(campaigns).toContain('data-testid="demo-create-campaign"');
  });

  it('keeps calendar controls as visible cards and makes campaign filters full height', () => {
    const css = read('apps/web/src/styles/mobile-precise-nov03.css');
    expect(css).toContain('oma-cal-request-approvals');
    expect(css).toContain('oma-pv-icon-btn');
    expect(css).toContain('height: var(--oma-mobile-vh, 100dvh) !important');
    expect(css).toContain('overflow-y: auto !important');
  });
});
