import {
  expiresIn,
  httpError,
  readJson,
  type ConnectedAccount,
  type FetchLike,
  type PublishablePage,
  type PublishInput,
  type PublishResult,
  type SocialProviderAdapter,
  type TokenSet,
} from './adapter';

type Env = {
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  LINKEDIN_API_VERSION?: string;
  LINKEDIN_ORGANIZATIONS?: string;
};

/**
 * LinkedIn: Sign In with LinkedIn (OpenID) + Share on LinkedIn (w_member_social) via the
 * Posts API. Organization pages need the Community Management API product
 * (w_organization_social, r_organization_admin); enabled with LINKEDIN_ORGANIZATIONS=1.
 * Docs: https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api
 */
export class LinkedInAdapter implements SocialProviderAdapter {
  readonly network = 'linkedin' as const;
  readonly requiredEnv = ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'] as const;
  readonly usesPkce = false;
  constructor(
    private readonly env: Env = process.env,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  isConfigured() {
    return Boolean(this.env.LINKEDIN_CLIENT_ID && this.env.LINKEDIN_CLIENT_SECRET);
  }

  private orgs() {
    return this.env.LINKEDIN_ORGANIZATIONS === '1';
  }

  private scopes() {
    return [
      'openid',
      'profile',
      'w_member_social',
      ...(this.orgs() ? ['w_organization_social', 'r_organization_admin'] : []),
    ];
  }

  authorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
    const q = new URLSearchParams({
      response_type: 'code',
      client_id: this.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri,
      state,
      scope: this.scopes().join(' '),
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
  }

  private async token(params: Record<string, string>): Promise<TokenSet> {
    const res = await this.fetchFn('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: this.env.LINKEDIN_CLIENT_ID!,
        client_secret: this.env.LINKEDIN_CLIENT_SECRET!,
      }).toString(),
    });
    const b = await readJson(res);
    if (!res.ok) throw httpError('linkedin', res, b);
    return {
      accessToken: String(b.access_token),
      refreshToken: (b.refresh_token as string) ?? null,
      expiresAt: expiresIn(b.expires_in),
      refreshExpiresAt: expiresIn(b.refresh_token_expires_in),
      scopes: typeof b.scope === 'string' ? b.scope.split(/[ ,]+/) : this.scopes(),
    };
  }

  private headers(token: string) {
    return {
      authorization: `Bearer ${token}`,
      'linkedin-version': this.env.LINKEDIN_API_VERSION || '202410',
      'x-restli-protocol-version': '2.0.0',
      'content-type': 'application/json',
    };
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }) {
    const token = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    const res = await this.fetchFn('https://api.linkedin.com/v2/userinfo', {
      headers: { authorization: `Bearer ${token.accessToken}` },
    });
    const me = await readJson(res);
    if (!res.ok) throw httpError('linkedin', res, me);
    const out: ConnectedAccount[] = [
      {
        externalId: `urn:li:person:${String(me.sub)}`,
        name: String(me.name ?? [me.given_name, me.family_name].filter(Boolean).join(' ')),
        avatarUrl: (me.picture as string) ?? null,
        token,
        meta: { kind: 'person' },
      },
    ];
    if (this.orgs()) {
      const r = await this.fetchFn(
        'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
        { headers: this.headers(token.accessToken) },
      );
      const acl = await readJson(r);
      if (r.ok) {
        for (const e of (acl.elements as Array<{ organization?: string }> | undefined) ?? []) {
          if (!e.organization) continue;
          const id = e.organization.split(':').pop()!;
          const o = await this.fetchFn(`https://api.linkedin.com/rest/organizations/${id}`, {
            headers: this.headers(token.accessToken),
          });
          const org = await readJson(o);
          out.push({
            externalId: e.organization,
            name: String((org.localizedName as string) ?? e.organization),
            avatarUrl: null,
            token,
            meta: { kind: 'organization' },
          });
        }
      }
    }
    return out;
  }

  async refresh(page: PublishablePage): Promise<TokenSet | null> {
    if (!page.refreshToken) return null; // 60-day token without refresh: reconnect before expiry
    return this.token({ grant_type: 'refresh_token', refresh_token: page.refreshToken });
  }

  async publish(page: PublishablePage, post: PublishInput): Promise<PublishResult> {
    const res = await this.fetchFn('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: this.headers(page.accessToken),
      body: JSON.stringify({
        author: page.externalId,
        commentary: post.text,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!res.ok) throw httpError('linkedin', res, await readJson(res));
    const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id') ?? '';
    return { externalId: urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null };
  }
}
