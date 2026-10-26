import {
  expiresIn,
  httpError,
  readJson,
  type FetchLike,
  type PublishablePage,
  type PublishInput,
  type PublishResult,
  type SocialProviderAdapter,
  type TokenSet,
} from './adapter';

type Env = { X_CLIENT_ID?: string; X_CLIENT_SECRET?: string };
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];

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
}
