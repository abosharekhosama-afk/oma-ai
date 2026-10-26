import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aspectRatioFor,
  CAPTION_LIMIT,
  initials,
  isPlaceholderAsset,
  resolveLayout,
  resolveNetwork,
  splitCaption,
  tokenizeCaption,
} from '../../apps/web/src/components/content/post-preview-model';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('post preview model', () => {
  it('resolves networks from channel names', () => {
    expect(resolveNetwork('Instagram')).toBe('instagram');
    expect(resolveNetwork('Meta Ads')).toBe('facebook');
    expect(resolveNetwork('Facebook Page')).toBe('facebook');
    expect(resolveNetwork('LinkedIn')).toBe('linkedin');
    expect(resolveNetwork('TikTok')).toBe('tiktok');
    expect(resolveNetwork('X')).toBe('x');
    expect(resolveNetwork('Twitter')).toBe('x');
    expect(resolveNetwork('Email')).toBe('generic');
    expect(resolveNetwork('')).toBe('generic');
  });

  it('uses vertical 9:16 for stories, reels and TikTok', () => {
    expect(resolveLayout('instagram', 'STORY')).toBe('vertical');
    expect(resolveLayout('instagram', 'REEL')).toBe('vertical');
    expect(resolveLayout('facebook', 'STORY')).toBe('vertical');
    expect(resolveLayout('tiktok', 'POST')).toBe('vertical');
    expect(resolveLayout('linkedin', 'REEL')).toBe('feed');
    expect(aspectRatioFor('instagram', 'STORY')).toBe('9 / 16');
    expect(aspectRatioFor('tiktok', 'STATIC')).toBe('9 / 16');
  });

  it('uses network-correct feed aspect ratios', () => {
    expect(aspectRatioFor('instagram', 'STATIC')).toBe('1 / 1');
    expect(aspectRatioFor('instagram', 'POST')).toBe('4 / 5');
    expect(aspectRatioFor('instagram', 'CAROUSEL')).toBe('4 / 5');
    expect(aspectRatioFor('facebook', 'POST')).toBe('1.91 / 1');
    expect(aspectRatioFor('linkedin', 'STATIC')).toBe('1.91 / 1');
    expect(aspectRatioFor('linkedin', 'REEL')).toBe('16 / 9');
    expect(aspectRatioFor('x', 'POST')).toBe('16 / 9');
    expect(aspectRatioFor('generic', 'POST')).toBe('4 / 3');
  });

  it('truncates captions for "see more" on a word boundary', () => {
    const long = 'word '.repeat(80).trim();
    const r = splitCaption(long, CAPTION_LIMIT.instagram);
    expect(r.truncated).toBe(true);
    expect(r.visible.length).toBeLessThanOrEqual(CAPTION_LIMIT.instagram);
    expect(r.visible.endsWith('word')).toBe(true);
    expect(splitCaption('short', 100)).toEqual({ visible: 'short', truncated: false });
  });

  it('tokenizes hashtags including Arabic', () => {
    const segs = tokenizeCaption('إطلاق جديد #رمضان and #Sale_2026 @oma');
    expect(segs.filter((s) => s.tag).map((s) => s.text)).toEqual(['#رمضان', '#Sale_2026', '@oma']);
    expect(segs.map((s) => s.text).join('')).toBe('إطلاق جديد #رمضان and #Sale_2026 @oma');
    expect(initials('Summer Organic')).toBe('SO');
  });
});

describe('PostPreview dispatcher wiring', () => {
  const src = read('apps/web/src/components/content/post-preview.tsx');
  it('dispatches every network and keeps captions dir="auto"', () => {
    for (const c of [
      'InstagramPreview',
      'VerticalPreview',
      'FacebookPreview',
      'LinkedInPreview',
      'XPreview',
      'GenericPreview',
    ])
      expect(src).toContain(`<${c} ctx={ctx} />`);
    expect(src).toContain('dir="auto"');
    expect(src).not.toMatch(/isAr \?/);
  });
  it('is the Feed rendering and the detail preview pane', () => {
    const client = read('apps/web/src/app/(app)/app/content/content-client.tsx');
    expect(client).toContain('filtered.map((item) => renderFeedPost(item))');
    expect(client).toContain('<FeedPost');
    expect(client).toContain('content-detail-preview');
    expect(
      read('apps/web/src/app/(app)/app/deliverables/[deliverableId]/deliverable-client.tsx'),
    ).toContain('<PostPreview');
  });
  it('styles stay calm: logical props, no gradients or glows', () => {
    const css = read('apps/web/src/styles/post-preview.css');
    expect(css).not.toMatch(/gradient|glow|purple|#8b5cf6|#7c3aed/i);
    expect(css).not.toMatch(/\b(margin|padding)-(left|right)\b|\b(left|right):/);
  });
});

import { approvalCounter, relativeTime } from '../../apps/web/src/components/content/feed-post';

describe('Planable feed row', () => {
  it('shows an n/m counter only for multi-approver flows', () => {
    expect(approvalCounter({ approved: 2, required: 4, state: 'PARTIALLY_APPROVED' })).toBe('2/4');
    expect(approvalCounter({ approved: 0, required: 1, state: 'PENDING' })).toBe('');
    expect(approvalCounter({ approved: 0, required: 3, state: 'NOT_REQUESTED' })).toBe('');
  });
  it('formats comment times relatively in both locales', () => {
    const now = Date.parse('2026-10-26T12:00:00Z');
    expect(relativeTime('2026-10-26T10:00:00Z', 'en', now)).toMatch(/2/);
    expect(relativeTime('2026-10-26T10:00:00Z', 'ar', now)).toMatch(/[\u0600-\u06FF]/);
  });
  it('treats bundled poster art as missing media', () => {
    expect(isPlaceholderAsset('/demo/poster-static.svg')).toBe(true);
    expect(isPlaceholderAsset('/demo/video-poster.svg')).toBe(true);
    expect(isPlaceholderAsset('https://cdn.example.com/a.jpg')).toBe(false);
    expect(isPlaceholderAsset(null)).toBe(true);
  });
  it('uses a single centered column with a side comments panel and no overlays', () => {
    const css = read('apps/web/src/styles/post-preview.css');
    expect(css).toMatch(/\.oma-content-feed--preview \{[^}]*flex-direction: column/);
    expect(css).toMatch(/grid-template-columns: 32px minmax\(0, 500px\) 340px/);
    expect(css).not.toMatch(/oma-pp__v-(top|bottom)|rgb\(0 0 0 \/ (25|35)%\)/);
    expect(read('apps/web/src/components/content/post-preview.tsx')).not.toContain('oma-pp__v-');
  });
});
