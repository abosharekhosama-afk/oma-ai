import { describe, expect, it } from 'vitest';
import { oauthRedirectUri } from '../../apps/api/src/social/social.service';

describe('social OAuth redirect URIs', () => {
  it('uses the explicit TikTok callback when configured', () => {
    expect(
      oauthRedirectUri('tiktok', {
        TIKTOK_REDIRECT_URI: ' https://oma-ai-ecru.vercel.app/api/v1/social/oauth/tiktok/callback ',
        SOCIAL_OAUTH_REDIRECT_BASE: 'https://wrong.example.com',
      }),
    ).toBe('https://oma-ai-ecru.vercel.app/api/v1/social/oauth/tiktok/callback');
  });

  it('supports separate explicit Meta callbacks', () => {
    const env = {
      META_FACEBOOK_REDIRECT_URI: 'https://example.com/api/v1/social/oauth/facebook/callback',
      META_INSTAGRAM_REDIRECT_URI: 'https://example.com/api/v1/social/oauth/instagram/callback',
    };
    expect(oauthRedirectUri('facebook', env)).toBe(env.META_FACEBOOK_REDIRECT_URI);
    expect(oauthRedirectUri('instagram', env)).toBe(env.META_INSTAGRAM_REDIRECT_URI);
  });

  it('builds the documented callback from the public base when no override exists', () => {
    expect(
      oauthRedirectUri('tiktok', { SOCIAL_OAUTH_REDIRECT_BASE: 'https://oma-ai-ecru.vercel.app/' }),
    ).toBe('https://oma-ai-ecru.vercel.app/api/v1/social/oauth/tiktok/callback');
  });
});
