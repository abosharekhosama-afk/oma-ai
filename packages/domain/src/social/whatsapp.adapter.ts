import {
  expiresIn,
  httpError,
  readJson,
  SocialProviderError,
  type ConnectedAccount,
  type FetchLike,
  type PostInsights,
  type PublishablePage,
  type PublishInput,
  type PublishResult,
  type SocialProviderAdapter,
  type TokenSet,
} from './adapter';

const GRAPH = 'https://graph.facebook.com';

type Env = { META_APP_ID?: string; META_APP_SECRET?: string; META_GRAPH_VERSION?: string };

/**
 * WhatsApp Cloud API via the same Meta app as Facebook/Instagram.
 * Inbox + replies are first-class. Calendar feed posts are not a WhatsApp surface.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export class WhatsAppAdapter implements SocialProviderAdapter {
  readonly network = 'whatsapp' as const;
  readonly requiredEnv = ['META_APP_ID', 'META_APP_SECRET'] as const;
  readonly usesPkce = false;
  constructor(
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
    return ['business_management', 'whatsapp_business_management', 'whatsapp_business_messaging'];
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

  async exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }) {
    const short = await this.get('oauth/access_token', {
      client_id: this.env.META_APP_ID!,
      client_secret: this.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code,
    });
    const long = await this.get('oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: this.env.META_APP_ID!,
      client_secret: this.env.META_APP_SECRET!,
      fb_exchange_token: String(short.access_token),
    });
    const userToken = String(long.access_token);
    const token: TokenSet = {
      accessToken: userToken,
      expiresAt: expiresIn(long.expires_in) ?? null,
      scopes: this.scopes(),
    };
    const out: ConnectedAccount[] = [];
    const businesses = await this.get('me/businesses', {
      access_token: userToken,
      fields: 'id,name',
      limit: '50',
    }).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
    const bizRows = (businesses.data as Array<Record<string, unknown>> | undefined) ?? [];
    const wabas: Array<{ id: string; name?: string }> = [];
    for (const biz of bizRows) {
      const owned = await this.get(`${biz.id}/owned_whatsapp_business_accounts`, {
        access_token: userToken,
        fields: 'id,name',
        limit: '50',
      }).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
      for (const w of (owned.data as Array<Record<string, unknown>> | undefined) ?? []) {
        wabas.push({ id: String(w.id), name: typeof w.name === 'string' ? w.name : undefined });
      }
    }
    for (const waba of wabas) {
      const phones = await this.get(`${waba.id}/phone_numbers`, {
        access_token: userToken,
        fields: 'id,display_phone_number,verified_name,quality_rating',
        limit: '50',
      }).catch(() => ({ data: [] as Array<Record<string, unknown>> }));
      for (const p of (phones.data as Array<Record<string, unknown>> | undefined) ?? []) {
        const display = String(p.display_phone_number ?? p.id);
        const verified = String(p.verified_name ?? waba.name ?? display);
        out.push({
          externalId: String(p.id),
          name: `${verified} (${display})`,
          avatarUrl: null,
          token,
          meta: {
            waba_id: waba.id,
            phone_number_id: String(p.id),
            display_phone_number: display,
            quality_rating: p.quality_rating ?? null,
          },
        });
      }
    }
    return out;
  }

  async refresh(page: PublishablePage): Promise<TokenSet | null> {
    await this.get(page.externalId, { fields: 'id', access_token: page.accessToken });
    return null;
  }

  async publish(_page: PublishablePage, _post: PublishInput): Promise<PublishResult> {
    throw new SocialProviderError(
      'whatsapp: Cloud API is a messaging channel. Send replies from Inbox; calendar feed posts are not published to WhatsApp.',
      { retryable: false },
    );
  }

  async sendMessage(
    page: PublishablePage,
    input: { to: string; text?: string; mediaUrl?: string | null },
  ): Promise<{ externalId: string }> {
    const to = input.to.replace(/[^\d]/g, '');
    if (!to) {
      throw new SocialProviderError('whatsapp: recipient phone is required', { retryable: false });
    }
    const bodyPayload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
    };
    if (input.mediaUrl) {
      bodyPayload.type = 'image';
      bodyPayload.image = { link: input.mediaUrl, caption: input.text || undefined };
    } else {
      bodyPayload.type = 'text';
      bodyPayload.text = { preview_url: false, body: input.text || '' };
    }
    const res = await this.fetchFn(`${GRAPH}/${this.v}/${page.externalId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${page.accessToken}`,
      },
      body: JSON.stringify(bodyPayload),
    });
    const body = await readJson(res);
    if (!res.ok) throw httpError(this.network, res, body);
    const messages = body.messages as Array<{ id?: string }> | undefined;
    const id = messages?.[0]?.id;
    if (!id) {
      throw new SocialProviderError('whatsapp: send returned no message id', { retryable: true });
    }
    return { externalId: id };
  }

  /** WhatsApp Cloud API has no list-recent-posts endpoint; historical import skips this network. */
  async fetchInsights(
    _page: PublishablePage,
    _externalPostId: string,
  ): Promise<PostInsights | null> {
    return null;
  }
}
