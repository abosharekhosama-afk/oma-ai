import { describe, expect, it } from 'vitest';
import {
  createSocialAdapter,
  decryptToken,
  encryptToken,
  LinkedInAdapter,
  MetaAdapter,
  parseEncryptionKey,
  pkceChallenge,
  socialAvailability,
  SocialProviderError,
  TikTokAdapter,
  TokenCryptoError,
  XAdapter,
  type FetchLike,
} from '@oma/domain';

const KEY_HEX = 'a'.repeat(64);
const key = parseEncryptionKey(KEY_HEX)!;

type Call = { url: string; init?: RequestInit };
function mockFetch(routes: Array<[RegExp, (c: Call) => Response]>) {
  const calls: Call[] = [];
  const fn: FetchLike = async (url, init) => {
    const c = { url: String(url), init };
    calls.push(c);
    const r = routes.find(([re]) => re.test(c.url));
    if (!r) throw new Error(`unexpected fetch ${c.url}`);
    return r[1](c);
  };
  return { fn, calls };
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const form = (c: Call) => new URLSearchParams(String(c.init?.body ?? ''));

describe('token encryption (AES-256-GCM)', () => {
  it('round-trips and never stores plaintext', () => {
    const enc = encryptToken('secret-token-123', key);
    expect(enc.startsWith('v1.')).toBe(true);
    expect(enc).not.toContain('secret-token-123');
    expect(decryptToken(enc, key)).toBe('secret-token-123');
    // Random IV: same input encrypts differently.
    expect(encryptToken('secret-token-123', key)).not.toBe(enc);
  });
  it('rejects a wrong key and tampering', () => {
    const enc = encryptToken('t', key);
    expect(() => decryptToken(enc, parseEncryptionKey('b'.repeat(64))!)).toThrow(TokenCryptoError);
    const parts = enc.split('.');
    parts[3] = Buffer.from('xx').toString('base64url');
    expect(() => decryptToken(parts.join('.'), key)).toThrow(TokenCryptoError);
  });
  it('accepts 32-byte base64 or hex keys only', () => {
    expect(parseEncryptionKey(Buffer.alloc(32, 7).toString('base64'))).toHaveLength(32);
    expect(parseEncryptionKey('short')).toBeNull();
    expect(parseEncryptionKey(undefined)).toBeNull();
  });
});

describe('provider availability', () => {
  it('offers a network only when its keys and the encryption key are set', () => {
    const none = socialAvailability({});
    expect(none.every((p) => !p.available && p.reason === 'not_configured')).toBe(true);
    const noKey = socialAvailability({ X_CLIENT_ID: 'id', X_CLIENT_SECRET: 's' });
    expect(noKey.find((p) => p.network === 'x')).toMatchObject({
      available: false,
      reason: 'encryption_key_missing',
    });
    const ok = socialAvailability({
      X_CLIENT_ID: 'id',
      X_CLIENT_SECRET: 's',
      META_APP_ID: 'a',
      META_APP_SECRET: 'b',
      SOCIAL_TOKEN_ENCRYPTION_KEY: KEY_HEX,
    });
    expect(ok.filter((p) => p.available).map((p) => p.network)).toEqual([
      'facebook',
      'instagram',
      'x',
    ]);
  });
});

describe('Meta adapter', () => {
  const env = { META_APP_ID: 'app', META_APP_SECRET: 'sec' };
  it('builds the dialog URL with page publishing scopes', () => {
    const u = new URL(
      new MetaAdapter('facebook', env).authorizeUrl({ state: 's1', redirectUri: 'https://w/cb' }),
    );
    expect(u.origin).toBe('https://www.facebook.com');
    expect(u.searchParams.get('scope')).toContain('pages_manage_posts');
    expect(u.searchParams.get('state')).toBe('s1');
  });
  it('exchanges code → long-lived token → pages (and IG accounts)', async () => {
    const m = mockFetch([
      [/oauth\/access_token\?.*code=c1/, () => json({ access_token: 'short' })],
      [
        /oauth\/access_token\?.*fb_exchange_token=short/,
        () => json({ access_token: 'long', expires_in: 5e6 }),
      ],
      [
        /me\/accounts/,
        () =>
          json({
            data: [
              {
                id: 'p1',
                name: 'Page One',
                access_token: 'pt1',
                picture: { data: { url: 'https://img/p1' } },
                instagram_business_account: { id: 'ig1', username: 'brand_ig' },
              },
              { id: 'p2', name: 'Page Two', access_token: 'pt2' },
            ],
          }),
      ],
    ]);
    const fb = await new MetaAdapter('facebook', env, m.fn).exchangeCode({
      code: 'c1',
      redirectUri: 'https://w/cb',
    });
    expect(fb.map((a) => [a.externalId, a.token.accessToken])).toEqual([
      ['p1', 'pt1'],
      ['p2', 'pt2'],
    ]);
    expect(fb[0]!.token.expiresAt).toBeNull();
    const ig = await new MetaAdapter('instagram', env, m.fn).exchangeCode({
      code: 'c1',
      redirectUri: 'https://w/cb',
    });
    expect(ig).toHaveLength(1);
    expect(ig[0]).toMatchObject({ externalId: 'ig1', name: 'brand_ig', meta: { page_id: 'p1' } });
  });
  it('publishes to a Page feed and an Instagram container', async () => {
    const m = mockFetch([
      [/\/p1\/feed$/, () => json({ id: 'p1_99' })],
      [/\/ig1\/media$/, () => json({ id: 'cont1' })],
      [/\/ig1\/media_publish$/, () => json({ id: 'm77' })],
      [/\/m77\?/, () => json({ permalink: 'https://www.instagram.com/p/abc/' })],
    ]);
    const page = { externalId: 'p1', name: 'P', accessToken: 'pt1', meta: {} };
    expect(await new MetaAdapter('facebook', env, m.fn).publish(page, { text: 'Hello' })).toEqual({
      externalId: 'p1_99',
      url: 'https://www.facebook.com/p1_99',
    });
    expect(form(m.calls[0]!).get('message')).toBe('Hello');
    const ig = await new MetaAdapter('instagram', env, m.fn).publish(
      { ...page, externalId: 'ig1' },
      { text: 'Cap', mediaUrl: 'https://cdn/img.jpg' },
    );
    expect(ig).toEqual({ externalId: 'm77', url: 'https://www.instagram.com/p/abc/' });
    await expect(
      new MetaAdapter('instagram', env, m.fn).publish(page, { text: 'no image' }),
    ).rejects.toMatchObject({
      opts: { retryable: false },
    });
  });
  it('maps an expired token (code 190) to reauth and 5xx to retryable', async () => {
    const m = mockFetch([
      [/\/p1\/feed$/, () => json({ error: { message: 'Session expired', code: 190 } }, 400)],
      [/\/p2\/feed$/, () => json({ error: { message: 'down' } }, 503)],
    ]);
    const a = new MetaAdapter('facebook', env, m.fn);
    const e1 = await a
      .publish({ externalId: 'p1', name: '', accessToken: 't', meta: {} }, { text: 'x' })
      .catch((e) => e);
    expect(e1).toBeInstanceOf(SocialProviderError);
    expect(e1.opts).toMatchObject({ reauth: true, retryable: false });
    const e2 = await a
      .publish({ externalId: 'p2', name: '', accessToken: 't', meta: {} }, { text: 'x' })
      .catch((e) => e);
    expect(e2.opts).toMatchObject({ retryable: true });
  });
});

describe('LinkedIn adapter', () => {
  const env = { LINKEDIN_CLIENT_ID: 'li', LINKEDIN_CLIENT_SECRET: 'ls' };
  it('exchanges the code and reads the member via OpenID userinfo', async () => {
    const m = mockFetch([
      [
        /oauth\/v2\/accessToken/,
        () =>
          json({
            access_token: 'lat',
            expires_in: 5184000,
            scope: 'openid,profile,w_member_social',
          }),
      ],
      [/v2\/userinfo/, () => json({ sub: 'abc', name: 'Sara A', picture: 'https://img/s' })],
    ]);
    const [acct] = await new LinkedInAdapter(env, m.fn).exchangeCode({
      code: 'k',
      redirectUri: 'https://w/cb',
    });
    expect(acct).toMatchObject({ externalId: 'urn:li:person:abc', name: 'Sara A' });
    expect(acct!.token.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 59 * 86400_000);
    expect(form(m.calls[0]!).get('grant_type')).toBe('authorization_code');
  });
  it('publishes with the Posts API and returns the feed URL', async () => {
    const m = mockFetch([
      [
        /rest\/posts/,
        () => new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:7' } }),
      ],
    ]);
    const r = await new LinkedInAdapter(env, m.fn).publish(
      { externalId: 'urn:li:person:abc', name: '', accessToken: 'lat', meta: {} },
      { text: 'Hi' },
    );
    expect(r).toEqual({
      externalId: 'urn:li:share:7',
      url: 'https://www.linkedin.com/feed/update/urn:li:share:7/',
    });
    const body = JSON.parse(String(m.calls[0]!.init!.body));
    expect(body).toMatchObject({
      author: 'urn:li:person:abc',
      commentary: 'Hi',
      lifecycleState: 'PUBLISHED',
    });
    expect((m.calls[0]!.init!.headers as Record<string, string>)['linkedin-version']).toMatch(
      /^\d{6}$/,
    );
  });
  it('has no refresh without a refresh token (reconnect required)', async () => {
    expect(
      await new LinkedInAdapter(env).refresh({
        externalId: 'x',
        name: '',
        accessToken: 't',
        meta: {},
      }),
    ).toBeNull();
  });
});

describe('TikTok adapter', () => {
  const env = { TIKTOK_CLIENT_KEY: 'ck', TIKTOK_CLIENT_SECRET: 'cs' };
  const publishEnv = { ...env, TIKTOK_ENABLE_DIRECT_POST: '1' };
  it('requests only basic profile access until Direct Post is enabled', () => {
    const basic = new URL(
      new TikTokAdapter(env).authorizeUrl({ state: 's', redirectUri: 'https://w/cb' }),
    );
    expect(basic.searchParams.get('scope')).toBe('user.info.basic');
    const direct = new URL(
      new TikTokAdapter(publishEnv).authorizeUrl({ state: 's', redirectUri: 'https://w/cb' }),
    );
    expect(direct.searchParams.get('scope')).toBe('user.info.basic,video.publish');
  });
  it('exchanges, refreshes, and posts a photo via PULL_FROM_URL', async () => {
    const m = mockFetch([
      [
        /oauth\/token/,
        (c) =>
          json({
            access_token: form(c).get('grant_type') === 'refresh_token' ? 'tat2' : 'tat',
            refresh_token: 'trt',
            expires_in: 86400,
            refresh_expires_in: 31536000,
            open_id: 'o1',
          }),
      ],
      [
        /user\/info/,
        () =>
          json({
            data: { user: { open_id: 'o1', display_name: 'Brand TT', username: 'brandtt' } },
            error: { code: 'ok' },
          }),
      ],
      [
        /post\/publish\/content\/init/,
        () => json({ data: { publish_id: 'pub_1' }, error: { code: 'ok' } }),
      ],
    ]);
    const a = new TikTokAdapter(publishEnv, m.fn);
    const [acct] = await a.exchangeCode({ code: 'c', redirectUri: 'https://w/cb' });
    expect(acct).toMatchObject({ externalId: 'o1', name: 'Brand TT' });
    expect(m.calls[1]!.url).toContain('fields=open_id,display_name,avatar_url');
    expect(m.calls[1]!.url).not.toContain('username');
    const page = {
      externalId: 'o1',
      name: '',
      accessToken: 'tat',
      refreshToken: 'trt',
      meta: { username: 'brandtt', scopes: ['user.info.basic', 'video.publish'] },
    };
    expect((await a.refresh(page))!.accessToken).toBe('tat2');
    const r = await a.publish(page, { text: 'Look', mediaUrl: 'https://cdn/x.jpg' });
    expect(r.externalId).toBe('pub_1');
    const body = JSON.parse(String(m.calls.at(-1)!.init!.body));
    expect(body).toMatchObject({
      media_type: 'PHOTO',
      post_mode: 'DIRECT_POST',
      source_info: { source: 'PULL_FROM_URL' },
    });
    expect(body.post_info.privacy_level).toBe('SELF_ONLY');
  });

  it('preserves TikTok provider code, message, log id and HTTP status', async () => {
    const m = mockFetch([
      [
        /post\/publish\/content\/init/,
        () =>
          json(
            {
              error: {
                code: 'url_ownership_unverified',
                message: 'The URL prefix is not verified',
                log_id: '20261030-abc123',
              },
            },
            403,
          ),
      ],
    ]);
    const a = new TikTokAdapter(publishEnv, m.fn);
    const error = await a
      .publish(
        {
          externalId: 'o1',
          name: '',
          accessToken: 'tat',
          meta: { scopes: ['video.publish'] },
        },
        { text: 'Look', mediaUrl: 'https://cdn/x.jpg' },
      )
      .catch((e) => e as SocialProviderError);

    expect(error).toBeInstanceOf(SocialProviderError);
    expect(error.message).toContain('tiktok [url_ownership_unverified]');
    expect(error.message).toContain('The URL prefix is not verified');
    expect(error.message).toContain('log_id=20261030-abc123');
    expect(error.message).toContain('http_status=403');
    expect(error.opts).toMatchObject({
      providerCode: 'url_ownership_unverified',
      providerMessage: 'The URL prefix is not verified',
      providerLogId: '20261030-abc123',
      status: 403,
      retryable: false,
    });
  });
});

describe('X adapter', () => {
  const env = { X_CLIENT_ID: 'xid', X_CLIENT_SECRET: 'xsec' };
  it('uses PKCE S256 in the authorize URL', () => {
    const a = new XAdapter(env);
    expect(a.usesPkce).toBe(true);
    const u = new URL(
      a.authorizeUrl({
        state: 's',
        redirectUri: 'https://w/cb',
        codeChallenge: pkceChallenge('v'),
      }),
    );
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('scope')).toContain('offline.access');
  });
  it('exchanges with the verifier + basic auth, then tweets', async () => {
    const m = mockFetch([
      [
        /oauth2\/token/,
        () => json({ access_token: 'xat', refresh_token: 'xrt', expires_in: 7200 }),
      ],
      [/users\/me/, () => json({ data: { id: '42', name: 'Brand', username: 'brand' } })],
      [/2\/tweets$/, () => json({ data: { id: '1001' } }, 201)],
    ]);
    const a = new XAdapter(env, m.fn);
    const [acct] = await a.exchangeCode({
      code: 'c',
      redirectUri: 'https://w/cb',
      codeVerifier: 'ver',
    });
    expect(form(m.calls[0]!).get('code_verifier')).toBe('ver');
    expect((m.calls[0]!.init!.headers as Record<string, string>).authorization).toMatch(/^Basic /);
    expect(acct).toMatchObject({ externalId: '42', meta: { username: 'brand' } });
    const r = await a.publish(
      { externalId: '42', name: '', accessToken: 'xat', meta: { username: 'brand' } },
      { text: 'gm' },
    );
    expect(r).toEqual({ externalId: '1001', url: 'https://x.com/brand/status/1001' });
  });
  it('rate limits are retryable, 401 needs reauth', async () => {
    const m = mockFetch([
      [
        /2\/tweets$/,
        (c) =>
          String(
            c.init?.headers && (c.init.headers as Record<string, string>).authorization,
          ).includes('bad')
            ? json({ title: 'Unauthorized' }, 401)
            : json({ title: 'Too Many Requests' }, 429),
      ],
    ]);
    const a = new XAdapter(env, m.fn);
    const e429 = await a
      .publish({ externalId: '1', name: '', accessToken: 'ok', meta: {} }, { text: 'a' })
      .catch((e) => e);
    expect(e429.opts).toMatchObject({ retryable: true });
    const e401 = await a
      .publish({ externalId: '1', name: '', accessToken: 'bad', meta: {} }, { text: 'a' })
      .catch((e) => e);
    expect(e401.opts).toMatchObject({ reauth: true });
  });
  it('registry returns the right adapter per network', () => {
    expect(createSocialAdapter('instagram', {}).network).toBe('instagram');
    expect(createSocialAdapter('x', {})).toBeInstanceOf(XAdapter);
  });
});
