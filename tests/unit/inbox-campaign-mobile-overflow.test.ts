import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('inbox and campaign overview mobile overflow', () => {
  it('wraps inbox comment text and stacks panes without stretching the page', () => {
    const css = read('apps/web/src/styles/inbox-listening.css');
    expect(css).toContain('.oma-plx-inbox-comment-card__text {');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('word-break: break-word');
    expect(css).toContain('margin-inline: 42px 0');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('flex-direction: column');
    expect(css).toContain('.oma-plx-inbox-thread__actions');
    expect(css).toContain('flex-wrap: wrap');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('.oma-plx-inbox-comment-tree');
    expect(css).toContain('padding-inline-start: 12px');
    expect(css).toContain('margin-inline-start: 8px');
  });

  it('stacks campaign overview metrics and contains tables on phones', () => {
    const css = read('apps/web/src/app/globals.css');
    expect(css).toContain('@media (max-width: 980px)');
    expect(css).toContain('.oma-campaign-metrics');
    expect(css).toContain('.oma-campaign-detail');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('.oma-campaign-facts--brief');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('.oma-campaign-detail .oma-campaign-table');
    expect(css).toContain('overflow-wrap: anywhere');
  });
});
