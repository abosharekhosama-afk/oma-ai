import {
  httpError,
  readJson,
  SocialProviderError,
  type ConnectedAccount,
  type FetchLike,
  type PublishablePage,
  type PublishInput,
  type PublishResult,
  type SocialProviderAdapter,
  type TokenSet,
} from './adapter';

const GRAPH = 'https://graph.facebook.com';

type Env = { META_APP_ID?: string; META_APP_SECRET?: string; META_GRAPH_VERSION?: string };

/**
 * Meta Graph API: Facebook Pages (pages_manage_posts) and Instagram professional accounts
 * linked to those pages (instagram_content_publish). Docs:
 * https://developers.facebook.com/docs/pages-api/posts ,
 * https://developers.facebook.com/docs/instagram-platform/content-publishing
 */
export class MetaAdapter implements SocialProviderAdapter {
  readonly requiredEnv = ['META_APP_ID', 'META_APP_SECRET'] as const;
  readonly usesPkce = false;
  constructor(
    readonly network: 'facebook' | 'instagram',
    private readonly env: Env = process.env,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  private get v() {
    return this.env.META_GRAPH_VERSION || 'v21.0';
  }

  isConfigured() {
    return Boolean(this.env.META_APP_ID && this.env.META_APP_SECRET);
  }

  private scopes() {
    return this.network === 'facebook'
      ? ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']
      : [
          'pages_show_list',
          'pages_read_engagement',
          'business_management',
          'instagram_basic',
          'instagram_content_publish',
        ];
  }

  authorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
    const q = new URLSearchParams({
      client_id: this.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: this.scopes().join(','),
    });
    return `https://www.facebook.com/${this.v}/dialog/oauth?${q}`;
  }

  private async get(path: string, params: Record<string, string>) {
    const res = await this.fetchFn(`${GRAPH}/${this.v}/${path}?${new URLSearchParams(params)}`);
    const body = await readJson(res);
    if (!res.ok) throw httpError(this.network, res, body);
    return body;
  }

  private async post(path: string, params: Record<string, string>) {
    const res = await this.fetchFn(`${GRAPH}/${this.v}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    const body = await readJson(res);
    if (!res.ok) throw httpError(this.network, res, body);
    return body;
  }

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }) {
    const short = await this.get('oauth/access_token', {
      client_id: this.env.META_APP_ID!,
      client_secret: this.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    });
    // Long-lived user token → page tokens derived from it do not expire.
    const long = await this.get('oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: this.env.META_APP_ID!,
      client_secret: this.env.META_APP_SECRET!,
      fb_exchange_token: String(short.access_token),
    });
    const pages = await this.get('me/accounts', {
      access_token: String(long.access_token),
      fields:
        'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}',
      limit: '100',
    });
    const rows = (pages.data as Array<Record<string, unknown>> | undefined) ?? [];
    const out: ConnectedAccount[] = [];
    for (const p of rows) {
      const pageToken: TokenSet = {
        accessToken: String(p.access_token),
        expiresAt: null,
        scopes: this.scopes(),
      };
      if (this.network === 'facebook') {
        out.push({
          externalId: String(p.id),
          name: String(p.name),
          avatarUrl: ((p.picture as { data?: { url?: string } })?.data?.url as string) ?? null,
          token: pageToken,
          meta: { page_id: String(p.id) },
        });
      } else {
        const ig = p.instagram_business_account as Record<string, unknown> | undefined;
        if (!ig?.id) continue;
        out.push({
          externalId: String(ig.id),
          name: String(ig.username ?? ig.name ?? p.name),
          avatarUrl: (ig.profile_picture_url as string) ?? null,
          token: pageToken,
          meta: { page_id: String(p.id), username: ig.username ?? null },
        });
      }
    }
    return out;
  }

  /** Page tokens are long-lived; validate it still works (revoked → reauth). */
  async refresh(page: PublishablePage): Promise<TokenSet | null> {
    await this.get(page.externalId, { fields: 'id', access_token: page.accessToken });
    return null;
  }

  async publish(page: PublishablePage, post: PublishInput): Promise<PublishResult> {
    if (this.network === 'facebook') {
      const r = post.mediaUrl
        ? await this.post(`${page.externalId}/photos`, {
            url: post.mediaUrl,
            caption: post.text,
            access_token: page.accessToken,
          })
        : await this.post(`${page.externalId}/feed`, {
            message: post.text,
            access_token: page.accessToken,
          });
      const id = String(r.post_id ?? r.id);
      return { externalId: id, url: `https://www.facebook.com/${id}` };
    }
    if (!post.mediaUrl) {
      throw new SocialProviderError('instagram: an image is required to publish', {
        retryable: false,
      });
    }
    const container = await this.post(`${page.externalId}/media`, {
      image_url: post.mediaUrl,
      caption: post.text,
      access_token: page.accessToken,
    });
    const published = await this.post(`${page.externalId}/media_publish`, {
      creation_id: String(container.id),
      access_token: page.accessToken,
    });
    const id = String(published.id);
    let url: string | null = null;
    try {
      const info = await this.get(id, { fields: 'permalink', access_token: page.accessToken });
      url = (info.permalink as string) ?? null;
    } catch {
      url = null;
    }
    return { externalId: id, url };
  }
}
