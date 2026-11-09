import {
  expiresIn,
  httpError,
  readJson,
  SocialProviderError,
  type FetchLike,
  type PostInsights,
  type RecentNetworkPost,
  type PublishablePage,
  type PublishInput,
  type PublishResult,
  type SocialProviderAdapter,
  type TokenSet,
} from './adapter';

type Env = { X_CLIENT_ID?: string; X_CLIENT_SECRET?: string };
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'dm.read', 'dm.write'];

/**
 * X API v2, OAuth 2.0 Authorization Code with PKCE (confidential client).
 * Docs: https://docs.x.com/resources/fundamentals/authentication/oauth-2-0/authorization-code ,
 * https://docs.x.com/x-api/posts/creation-of-a-post
 */
export class XAdapter implements SocialProviderAdapter {
  readonly network = 'x' as const;
  readonly requiredEnv = ['X_CLIENT_ID', 'X_CLIENT_SECRET'] as const;
  readonly usesPkce = true;
  constructor(
    private readonly env: Env = process.env,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  isConfigured() {
    return Boolean(this.env.X_CLIENT_ID && this.env.X_CLIENT_SECRET);
  }

  authorizeUrl({
    state,
    redirectUri,
    codeChallenge,
  }: {
    state: string;
    redirectUri: string;
    codeChallenge?: string;
  }) {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: this.env.X_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      state,
      code_challenge: codeChallenge ?? '',
      code_challenge_method: 'S256',
    });
    return `https://x.com/i/oauth2/authorize?${q}`;
  }

  private async token(params: Record<string, string>): Promise<TokenSet> {
    const basic = Buffer.from(`${this.env.X_CLIENT_ID}:${this.env.X_CLIENT_SECRET}`).toString(
      'base64',
    );
    const res = await this.fetchFn('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({ ...params, client_id: this.env.X_CLIENT_ID! }).toString(),
    });
    const b = await readJson(res);
    if (!res.ok) throw httpError('x', res, b);
    return {
      accessToken: String(b.access_token),
      refreshToken: (b.refresh_token as string) ?? null,
      expiresAt: expiresIn(b.expires_in),
      scopes: typeof b.scope === 'string' ? b.scope.split(' ') : SCOPES,
    };
  }

  async exchangeCode({
    code,
    redirectUri,
    codeVerifier,
  }: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }) {
    const token = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier ?? '',
    });
    const res = await this.fetchFn(
      'https://api.x.com/2/users/me?user.fields=profile_image_url,username,name',
      {
        headers: { authorization: `Bearer ${token.accessToken}` },
      },
    );
    const b = await readJson(res);
    if (!res.ok) throw httpError('x', res, b);
    const u = (b.data ?? {}) as Record<string, unknown>;
    return [
      {
        externalId: String(u.id),
        name: String(u.name ?? u.username),
        avatarUrl: (u.profile_image_url as string) ?? null,
        token,
        meta: { username: u.username ?? null },
      },
    ];
  }

  async refresh(page: PublishablePage): Promise<TokenSet | null> {
    if (!page.refreshToken) return null;
    return this.token({ grant_type: 'refresh_token', refresh_token: page.refreshToken });
  }

  async publish(page: PublishablePage, post: PublishInput): Promise<PublishResult> {
    const res = await this.fetchFn('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: { authorization: `Bearer ${page.accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: post.text }),
    });
    const b = await readJson(res);
    if (!res.ok) throw httpError('x', res, b);
    const id = String((b.data as { id?: string })?.id);
    const username = page.meta.username as string | undefined;
    return { externalId: id, url: `https://x.com/${username ?? 'i/web'}/status/${id}` };
  }

  async fetchInsights(page: PublishablePage, externalPostId: string): Promise<PostInsights | null> {
    const id = encodeURIComponent(externalPostId.trim());
    if (!id) return null;
    const res = await this.fetchFn(`https://api.x.com/2/tweets/${id}?tweet.fields=public_metrics`, {
      headers: { authorization: `Bearer ${page.accessToken}` },
    });
    const b = await readJson(res);
    if (!res.ok) return null;
    const m = ((b.data as { public_metrics?: Record<string, number> } | undefined)
      ?.public_metrics ?? {}) as Record<string, number>;
    return {
      impressions: m.impression_count,
      likes: m.like_count,
      comments: m.reply_count,
      shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
      views: m.impression_count,
      fetchedAt: new Date().toISOString(),
    };
  }

  async listRecentPosts(
    page: PublishablePage,
    opts?: { limit?: number; since?: Date },
  ): Promise<RecentNetworkPost[]> {
    const userId = page.externalId.trim();
    if (!userId) return [];
    const limit = Math.min(100, Math.max(5, opts?.limit ?? 20));
    const url = new URL(`https://api.x.com/2/users/${encodeURIComponent(userId)}/tweets`);
    url.searchParams.set('max_results', String(limit));
    url.searchParams.set('tweet.fields', 'created_at,public_metrics');
    if (opts?.since) url.searchParams.set('start_time', opts.since.toISOString());
    const res = await this.fetchFn(url.toString(), {
      headers: { authorization: `Bearer ${page.accessToken}` },
    });
    const b = await readJson(res);
    if (!res.ok) return [];
    const list = (b.data as Array<Record<string, unknown>> | undefined) ?? [];
    const out: RecentNetworkPost[] = [];
    for (const row of list) {
      const id = String(row.id ?? '');
      const created = row.created_at ? new Date(String(row.created_at)) : null;
      if (!id || !created || Number.isNaN(created.getTime())) continue;
      const m = (row.public_metrics as Record<string, number> | undefined) ?? {};
      out.push({
        externalPostId: id,
        publishedAt: created,
        insights: {
          impressions: m.impression_count,
          likes: m.like_count,
          comments: m.reply_count,
          shares: (m.retweet_count ?? 0) + (m.quote_count ?? 0),
          views: m.impression_count,
          fetchedAt: new Date().toISOString(),
        },
      });
    }
    return out;
  }

  async sendMessage(
    page: PublishablePage,
    input: { to: string; text?: string },
  ): Promise<{ externalId: string }> {
    const to = input.to.trim();
    if (!to) {
      throw new SocialProviderError('x: recipient id is required', { retryable: false });
    }
    const res = await this.fetchFn(
      `https://api.x.com/2/dm_conversations/with/${encodeURIComponent(to)}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${page.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: input.text || '' }),
      },
    );
    const b = await readJson(res);
    if (!res.ok) throw httpError('x', res, b);
    const id = String(
      (b.data as { dm_event_id?: string } | undefined)?.dm_event_id ??
        (b.data as { id?: string } | undefined)?.id ??
        '',
    );
    if (!id) {
      throw new SocialProviderError('x: send returned no message id', { retryable: true });
    }
    return { externalId: id };
  }
}
