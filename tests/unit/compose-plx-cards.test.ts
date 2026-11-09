import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Planable compose labels / templates / media cards', () => {
  it('renders Template and Labels flyouts with search, create, and apply actions', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    const pills = read('apps/web/src/components/content/compose-meta-pills.tsx');
    expect(client).toContain('demo-compose-templates');
    expect(client).toContain('demo-content-templates');
    expect(pills).toContain('Apply post template');
    expect(client).toContain('demo-compose-labels');
    expect(client).toContain('demo-content-labels');
    expect(pills).toContain('Add labels');
    expect(pills).toContain('Create new label');
    expect(pills).toContain('Create new template');
    expect(client).toContain('createBrandTemplate');
    expect(client).toContain('onApplyTemplate');
  });

  it('keeps first-comment, image-link, GIF, and date popovers in compose', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    const toolbar = read('apps/web/src/components/content/compose-media-toolbar.tsx');
    expect(client).toContain('compose-first-comment');
    expect(client).toContain('FIRST COMMENT');
    expect(client).toContain('compose-datetime-toggle');
    expect(client).toContain('BestTimeSuggestions');
    const suggest = read('apps/web/src/components/content/best-time-suggestions.tsx');
    expect(suggest).toContain("t('content.bestTime.title')");
    expect(client).toContain('demo.content.aiNotConnected');
    expect(toolbar).toContain('compose-link-field');
    expect(toolbar).toContain('Paste image URL');
    expect(toolbar).toContain('compose-gif-popover');
    expect(toolbar).toContain('Search for a GIF');
    expect(toolbar).toContain('onCaptionInsert');
  });

  it('styles flyouts, GIF grid, link field, first comment, and story drop to the Planable grammar', () => {
    const css = read('apps/web/src/styles/inbox-listening.css');
    expect(css).toContain('.oma-compose-flyout');
    expect(css).toContain('.oma-compose-label-row');
    expect(css).toContain('.oma-compose-gif__grid');
    expect(css).toContain('.oma-compose-link');
    expect(css).toContain('.oma-compose-first-comment__avatar');
    expect(css).toContain('.oma-compose-date-menu');
    expect(css).toContain('.oma-compose-story-drop__frame');
    expect(css).toContain('.oma-compose-icon-btn');
  });
});
