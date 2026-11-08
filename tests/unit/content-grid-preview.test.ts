import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { matchRequirements } from '../../apps/api/src/common/guards/capabilities.guard';
import { CONTENT_EMOJIS } from '../../apps/web/src/components/content/content-emoji-picker';

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('content grid + preview analytics', () => {
  it('uses a responsive auto-fill grid and hides captions until hover', () => {
    const tiles = read('apps/web/src/components/content/planable-views.tsx');
    const css = read('apps/web/src/styles/content-views.css');
    expect(tiles).toContain('oma-pv-tile__hover');
    expect(tiles).not.toContain('oma-pv-tile__top');
    expect(css).toContain('repeat(auto-fill, minmax(148px, 1fr))');
    expect(css).toContain('repeat(auto-fill, minmax(210px, 1fr))');
    expect(css).toContain('aspect-ratio: 4 / 5');
  });

  it('maps per-channel analytics for readers of the post', () => {
    expect(matchRequirements('GET', '/api/v1/content/abc123/channel-analytics')).toEqual([
      'content.read',
    ]);
    const service = read('apps/api/src/content/content.service.ts');
    const logic = read('apps/api/src/content/channel-analytics.ts');
    expect(service).toContain('parseInsights');
    expect(service).toContain('buildChannelAnalyticsView');
    expect(service).toContain('maybeRefreshPublishTargetInsights');
    expect(logic).toContain("'oma_local' as const");
    expect(logic).toContain('kpis: { views, engagements, reach }');
    expect(logic).toContain('isDemoModeEnabled');
    expect(logic).not.toContain('fallbackViews');
    const api = read('apps/web/src/lib/content-api.ts');
    expect(api).toContain('/api/v1/content/${contentId}/channel-analytics');
    expect(api).toContain("refresh: '1'");
    const analytics = read('apps/web/src/components/content/post-channel-analytics.tsx');
    expect(analytics).toContain('not_published');
    expect(analytics).toContain('no_data_yet');
    expect(analytics).toContain('not_connected');
  });

  it('reuses compose campaign/labels/templates cards in the preview header', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    const pills = read('apps/web/src/components/content/compose-meta-pills.tsx');
    expect(client).toContain('content-modal-templates');
    expect(client).toContain('content-modal-campaign');
    expect(client).toContain('content-modal-labels');
    expect(client).toContain('content-modal-analytics');
    expect(pills).toContain('Apply post template');
    expect(pills).toContain('Add labels');
    expect(client).toContain('PostChannelAnalytics');
    expect(client).toContain('ContentEmojiPicker');
  });

  it('ships a real emoji palette for caption, comments, and reactions', () => {
    expect(CONTENT_EMOJIS).toContain('😍');
    expect(CONTENT_EMOJIS).toContain('👍');
    expect(CONTENT_EMOJIS.length).toBeGreaterThanOrEqual(16);
    const picker = read('apps/web/src/components/content/content-emoji-picker.tsx');
    expect(picker).toContain('content-emoji-popover');
    const analytics = read('apps/web/src/components/content/post-channel-analytics.tsx');
    expect(analytics).toContain('content-channel-analytics');
    expect(analytics).toContain('Organic views');
    expect(analytics).toContain('Plays');
  });
});
