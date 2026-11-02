import { describe, expect, it } from 'vitest';
import { imageNeedsTranscode, validateMediaForNetwork } from './media-constraints';

describe('media constraints', () => {
  it('flags PNG for TikTok and requires transcode', () => {
    const issues = validateMediaForNetwork('tiktok', [{ mime: 'image/png', sizeBytes: 1000 }]);
    expect(issues.some((i) => i.code === 'photo_mime')).toBe(true);
    expect(imageNeedsTranscode('tiktok', 'image/png', 800, 800)).toBe(true);
  });

  it('flags oversized TikTok photos for resize', () => {
    expect(imageNeedsTranscode('tiktok', 'image/jpeg', 2000, 2000)).toBe(true);
    expect(imageNeedsTranscode('tiktok', 'image/jpeg', 1080, 1080)).toBe(false);
  });

  it('rejects unsupported TikTok video mime', () => {
    const issues = validateMediaForNetwork('tiktok', [{ mime: 'video/avi', sizeBytes: 1000 }]);
    expect(issues.some((i) => i.code === 'video_mime' && i.severity === 'error')).toBe(true);
  });
});
