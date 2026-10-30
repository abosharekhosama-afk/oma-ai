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

  it('describes skip reasons', () => {
    expect(skipReasonMessage('NOT_APPROVED')).toMatch(/not fully approved/i);
  });
});
