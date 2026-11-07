import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Mobile responsiveness: Top Header, Calendar Toolbar, and Off-Canvas Saved/Drafts Drawer', () => {
  it('provides mobile page titles across all workspaces in ShellChrome', () => {
    const chrome = readFileSync(resolve('apps/web/src/components/shell/shell-chrome.tsx'), 'utf8');
    expect(chrome).toContain('isApprovalsWorkspace');
    expect(chrome).toContain("t('views.my_approvals')");
    expect(chrome).toContain("t('nav.content')");
  });

  it('keeps the Saved/Drafts toggle accessible and defaults Saved closed on mobile/tablet', () => {
    const contentClient = readFileSync(
      resolve('apps/web/src/app/(app)/app/content/content-client.tsx'),
      'utf8',
    );
    expect(contentClient).toContain('window.innerWidth <= 1024');
    expect(contentClient).toContain('oma-cal-saved-backdrop');
    expect(contentClient).toContain('demo-content-saved-toggle');
  });

  it('styles the Saved column as an off-canvas drawer on <=1024px and unclips calendar toolbar popovers on <768px', () => {
    const mobileCss = readFileSync(resolve('apps/web/src/styles/mobile-nov02.css'), 'utf8');
    expect(mobileCss).toContain('.oma-cal-saved-backdrop');
    expect(mobileCss).toContain('overflow: visible !important');
    expect(mobileCss).toContain('.oma-pv-ds__pop');
    expect(mobileCss).toContain('.oma-ext-cal-pop');
  });
});
