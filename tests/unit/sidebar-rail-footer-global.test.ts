import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sidebar rail footer is global', () => {
  it('no longer pins account/notifications only on the activity page', () => {
    const css = readFileSync(resolve('apps/web/src/app/globals.css'), 'utf8');
    expect(css).not.toContain(
      'html body .oma-shell:has(.oma-activity-page) > .oma-rail > .oma-rail-footer',
    );
    expect(css).toContain('html body .oma-shell > .oma-rail > .oma-rail-footer');
    expect(css).toContain('account + notifications stay visible on every page');
    expect(css).toContain('align-items: stretch !important');
  });

  it('shell chrome always renders RailUtilities in the desktop rail', () => {
    const chrome = readFileSync(
      resolve('apps/web/src/components/shell/shell-chrome.tsx'),
      'utf8',
    );
    expect(chrome).toContain('data-testid="shell-rail-utilities"');
    expect(chrome).toContain('<RailUtilities />');
    expect(chrome).toContain('<UserMenu />');
    expect(chrome).toContain('<NotificationsBell />');
  });
});
