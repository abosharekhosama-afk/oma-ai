import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  aspectRatioFor,
  CAPTION_LIMIT,
  initials,
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
    expect(client).toContain("renderPostPreview(item, 'feed')");
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
