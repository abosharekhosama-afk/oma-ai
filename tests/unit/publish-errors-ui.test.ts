import { describe, expect, it } from 'vitest';
import { classifyPublishError, humanizePublishError } from '../../apps/web/src/lib/publish-errors';

describe('schedule UI publish errors', () => {
  it('shows remediation and the exact server diagnostic for TikTok URL failures', () => {
    const raw =
      'tiktok [url_ownership_unverified]: The URL prefix is not verified | log_id=abc123 | http_status=403';
    expect(classifyPublishError(raw)).toBe('PROVIDER_REJECTED');
    expect(humanizePublishError(raw, 'ar')).toContain('وثّق نطاق وسيط الوسائط');
    expect(humanizePublishError(raw, 'ar')).toContain(`تفاصيل الخادم: ${raw}`);
  });
});
