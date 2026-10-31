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

  it('shows TikTok format failures with accepted formats and the exact server diagnostic', () => {
    const raw =
      'tiktok [file_format_check_failed]: Unsupported media format or video codec. Use JPEG/WebP photos or MP4/WebM/MOV video with a supported codec.';
    expect(humanizePublishError(raw, 'en')).toContain('JPEG/WebP');
    expect(humanizePublishError(raw, 'en')).toContain('Provider details: ' + raw);
    expect(humanizePublishError(raw, 'ar')).toContain('JPEG أو WebP');
    expect(humanizePublishError(raw, 'ar')).toContain('تفاصيل المزود: ' + raw);
  });

  it('gives actionable guidance for missing Direct Post permission and unverified media domains', () => {
    expect(
      humanizePublishError('tiktok [scope_not_authorized]: video.publish is not granted', 'en'),
    ).toMatch(/Get the scope approved.*reconnect/i);
    expect(humanizePublishError('tiktok [url_ownership_unverified]: not verified', 'ar')).toMatch(
      /وثّق نطاق وسيط الوسائط/,
    );
  });

  it('describes skip reasons', () => {
    expect(skipReasonMessage('NOT_APPROVED')).toMatch(/not fully approved/i);
  });
});
