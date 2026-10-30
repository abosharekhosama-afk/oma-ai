import { describe, expect, it } from 'vitest';
import { classifyPublishError, humanizePublishError, skipReasonMessage } from './publish-errors';

describe('publish-errors', () => {
  it('classifies TikTok scope errors', () => {
    expect(
      classifyPublishError(
        'tiktok: video.publish is not authorized for this app. Enable Direct Post after TikTok approval, then reconnect the account.',
      ),
    ).toBe('SCOPE_MISSING');
  });

  it('humanizes in EN and AR', () => {
    const raw = 'tiktok: an image is required to publish';
    expect(humanizePublishError(raw, 'en')).toMatch(/image/i);
    expect(humanizePublishError(raw, 'ar')).toMatch(/صورة/);
  });

  it('keeps provider code, message, log id and status visible', () => {
    const raw =
      'tiktok [url_ownership_unverified]: The URL prefix is not verified | log_id=abc123 | http_status=403';
    expect(humanizePublishError(raw, 'en')).toContain('url_ownership_unverified');
    expect(humanizePublishError(raw, 'en')).toContain('log_id=abc123');
    expect(humanizePublishError(raw, 'en')).toContain('http_status=403');
  });

  it('describes skip reasons', () => {
    expect(skipReasonMessage('NOT_APPROVED')).toMatch(/not fully approved/i);
  });
});
