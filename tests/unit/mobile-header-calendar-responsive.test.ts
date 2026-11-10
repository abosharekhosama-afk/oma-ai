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
    expect(mobileCss).toContain('display: flex !important');
  });

  it('keeps calendar view as a grid on phones and never hides the Saved panel', () => {
    const stage3 = readFileSync(resolve('apps/web/src/styles/stage3.css'), 'utf8');
    expect(stage3).not.toMatch(
      /@media \(max-width: 720px\)[\s\S]{0,800}?\.oma-cal-grid \{\s*display: none;/,
    );
    expect(stage3).not.toMatch(
      /@media \(max-width: 720px\)[\s\S]{0,900}?\[data-testid='demo-content-saved'\] \{\s*display: none;/,
    );

    const polish = readFileSync(resolve('apps/web/src/styles/ui-polish.css'), 'utf8');
    expect(polish).toContain("[data-testid='demo-content-agenda']");
    expect(polish).toContain('display: none !important');
    expect(polish).toContain('height: min(78dvh, 640px) !important');

    const client = readFileSync(
      resolve('apps/web/src/app/(app)/app/content/content-client.tsx'),
      'utf8',
    );
    expect(client).toContain('demo-saved-place-${item.id}');
    expect(client).toContain('content.add_draft_to_selected_day');
  });
});
