import {
  expiresIn,
  httpError,
  readJson,
  SocialProviderError,
  type FetchLike,
  type PublishablePage,
  type PublishInput,
  type PublishResult,
  type SocialProviderAdapter,
  type TokenSet,
} from './adapter';

type Env = {
  TIKTOK_CLIENT_KEY?: string;
  TIKTOK_CLIENT_SECRET?: string;
  TIKTOK_PRIVACY_LEVEL?: string;
  TIKTOK_ENABLE_DIRECT_POST?: string;
};
const API = 'https://open.tiktokapis.com';

/**
 * TikTok Login Kit + Content Posting API (Direct Post, photo via PULL_FROM_URL).
 * Docs: https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
 * Unaudited apps can only post privately (SELF_ONLY), hence TIKTOK_PRIVACY_LEVEL.
 */
export class TikTokAdapter implements SocialProviderAdapter {
  readonly network = 'tiktok' as const;
  readonly requiredEnv = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'] as const;
  readonly usesPkce = false;
  constructor(
    private readonly env: Env = process.env,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  isConfigured() {
    return Boolean(this.env.TIKTOK_CLIENT_KEY && this.env.TIKTOK_CLIENT_SECRET);
  }

  authorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
    const scopes = ['user.info.basic'];
    if (this.env.TIKTOK_ENABLE_DIRECT_POST === '1') scopes.push('video.publish');
    const q = new URLSearchParams({
      client_key: this.env.TIKTOK_CLIENT_KEY!,
      response_type: 'code',
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
  }

  private async token(params: Record<string, string>): Promise<TokenSet & { openId?: string }> {
    const res = await this.fetchFn(`${API}/v2/oauth/token/`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_key: this.env.TIKTOK_CLIENT_KEY!,
        client_secret: this.env.TIKTOK_CLIENT_SECRET!,
      }).toString(),
    });
    const b = await readJson(res);
    if (!res.ok || b.error) throw httpError('tiktok', res, b);
    return {
      accessToken: String(b.access_token),
      refreshToken: (b.refresh_token as string) ?? null,
      expiresAt: expiresIn(b.expires_in),
      refreshExpiresAt: expiresIn(b.refresh_expires_in),
      scopes: typeof b.scope === 'string' ? b.scope.split(',') : [],
      openId: b.open_id as string,
    };
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }) {
    const token = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const res = await this.fetchFn(`${API}/v2/user/info/?fields=open_id,display_name,avatar_url`, {
      headers: { authorization: `Bearer ${token.accessToken}` },
    });
    const b = await readJson(res);
    const err = b.error as { code?: string } | undefined;
    if (!res.ok || (err?.code && err.code !== 'ok')) throw httpError('tiktok', res, b);
    const u = ((b.data as { user?: Record<string, unknown> })?.user ?? {}) as Record<
      string,
      unknown
    >;
    const { openId, ...t } = token;
    return [
      {
        externalId: String(u.open_id ?? openId),
        name: String(u.display_name ?? 'TikTok'),
        avatarUrl: (u.avatar_url as string) ?? null,
        token: t,
        meta: { scopes: token.scopes ?? [] },
      },
    ];
  }

  async refresh(page: PublishablePage): Promise<TokenSet | null> {
    if (!page.refreshToken) return null;
    const { openId: _o, ...t } = await this.token({
      grant_type: 'refresh_token',
      refresh_token: page.refreshToken,
    });
    return t;
  }

  async publish(page: PublishablePage, post: PublishInput): Promise<PublishResult> {
    const scopes = Array.isArray(page.meta.scopes) ? page.meta.scopes : [];
    if (!scopes.includes('video.publish')) {
      throw new SocialProviderError(
        'tiktok [scope_missing]: video.publish is not authorized for this app. Enable Direct Post after TikTok approval, then reconnect the account.',
        { retryable: false, providerCode: 'scope_missing' },
      );
    }
    if (!post.mediaUrl) {
      throw new SocialProviderError('tiktok [media_missing]: an image is required to publish', {
        retryable: false,
        providerCode: 'media_missing',
      });
    }
    const res = await this.fetchFn(`${API}/v2/post/publish/content/init/`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${page.accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: post.text.slice(0, 90),
          description: post.text.slice(0, 4000),
          privacy_level: this.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY',
          disable_comment: false,
          auto_add_music: true,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_cover_index: 0,
          photo_images: [post.mediaUrl],
        },
        post_mode: 'DIRECT_POST',
        media_type: 'PHOTO',
      }),
    });
    const b = await readJson(res);
    const err = b.error as { code?: string } | undefined;
    if (!res.ok || (err?.code && err.code !== 'ok')) throw httpError('tiktok', res, b);
    const publishId = String((b.data as { publish_id?: string })?.publish_id ?? '');
    const username = page.meta.username as string | undefined;
    // TikTok processes asynchronously; the public post id arrives later via status fetch.
    return { externalId: publishId, url: username ? `https://www.tiktok.com/@${username}` : null };
  }
}
