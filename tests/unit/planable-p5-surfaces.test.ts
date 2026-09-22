import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  EMPTY_DELIVERABLE_FILTERS,
  filterDeliverables,
  filterReviewQueue,
} from '../../apps/web/src/lib/demo/stage5-deliverables';
import { DEMO_GRAPH } from '../../packages/demo/src/index';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('P5 Planable deliverables/reviews/schedule surfaces', () => {
  it('rebuilds stage5 CSS without violet/signal/Frame aliases', () => {
    const css = read('apps/web/src/styles/stage5.css');
    expect(css).toContain('--oma-primary');
    expect(css).toContain('.oma-review-workspace');
    expect(css).toContain('.oma-sched-week');
    expect(css).not.toContain('--oma-violet');
    expect(css).not.toContain('--oma-signal');
    // light Planable review well token is allowed; Frame dark #121419 is not
    expect(css).toContain('var(--oma-review-canvas)');
    expect(css).not.toContain('#6658');
    expect(css).not.toContain('#121419');
    expect(css).not.toContain('--motion-micro');
  });

  it('removes Frame review-canvas token usage from deliverable client', () => {
    const client = read(
      'apps/web/src/app/(app)/app/deliverables/[deliverableId]/deliverable-client.tsx',
    );
    expect(client).toContain('demo-review-workspace');
    expect(client).toContain('demo-version-compare');
    expect(client).not.toContain('--oma-review-ink');
    expect(client).not.toContain('#121419');
  });

  it('rebuilds stage5 demo SVGs without violet/dark Frame branding', () => {
    const dir = join(root, 'apps/web/public/demo');
    const files = readdirSync(dir).filter((f) => f.startsWith('stage5-') && f.endsWith('.svg'));
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const file of files) {
      const svg = readFileSync(join(dir, file), 'utf8');
      expect(svg).not.toContain('#6658');
      expect(svg).not.toContain('#121419');
      expect(svg).not.toMatch(/IBM Plex/i);
      expect(svg).toContain('system-ui');
      expect(svg).toMatch(/#F5F6F7|#FFFFFF|#1677FF/i);
    }
  });

  it('filters deliverables and review queue without inventing statuses', () => {
    const filtered = filterDeliverables(
      DEMO_GRAPH.deliverables,
      { ...EMPTY_DELIVERABLE_FILTERS, group: 'needs_review' },
      'en',
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((d) => ['AWAITING_REVIEW', 'IN_REVIEW'].includes(d.reviewStatus))).toBe(
      true,
    );
    const queue = filterReviewQueue(DEMO_GRAPH.deliverables, 'approved');
    expect(queue.every((d) => d.reviewStatus === 'APPROVED')).toBe(true);
  });

  it('keeps schedule on Planable stage5 chrome classes', () => {
    const schedule = read('apps/web/src/app/(app)/app/schedule/page.tsx');
    expect(schedule).toContain('oma-stage5-tabs');
    expect(schedule).toContain('oma-stage5-toolbar');
    expect(schedule).toContain('demo-publish-blocked');
    expect(schedule).toContain('demo-schedule-reschedule-dialog');
    expect(schedule).not.toContain('oma-stage6-tabs');
  });

  it('documents remaining P6 aliases outside stage5', () => {
    const inventory = read('docs/PLANABLE_P1_COMPAT_INVENTORY.md');
    expect(inventory).toMatch(/Stage:\s*P6|P6/);
    expect(inventory).toMatch(/CLOSED|Deleted/i);
    const finalInv = read('docs/FINAL_COMPATIBILITY_INVENTORY.md');
    expect(finalInv).toMatch(/Runtime alias definitions\s*=\s*0/i);
  });
});
