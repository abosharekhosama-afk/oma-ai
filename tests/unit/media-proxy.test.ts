import { describe, expect, it } from 'vitest';
import { mediaProxyUrl } from '../../apps/worker/src/media/media-jobs';

describe('TikTok media proxy URL', () => {
  it('uses the configured public OMA origin and preserves the signed source URL', () => {
    const signed =
      'https://imkan-workdrive-v1.onrender.com/files/f1/preview?token=a%2Bb&expires=123';
    const result = new URL(mediaProxyUrl(signed, 'https://oma-ai-ecru.vercel.app/'));

    expect(result.origin).toBe('https://oma-ai-ecru.vercel.app');
    expect(result.pathname).toBe('/api/media-proxy');
    expect(result.searchParams.get('url')).toBe(signed);
  });

  it('rejects a non-HTTPS source URL', () => {
    expect(() =>
      mediaProxyUrl('http://workdrive.example/file', 'https://oma-ai-ecru.vercel.app'),
    ).toThrow('Media proxy source must use HTTPS');
  });
});
