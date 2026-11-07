import { getPrisma } from '@oma/db';
import { DomainError, newId, pkceChallenge, pkceVerifier } from '@oma/domain';

export const CURRENT_TERMS_VERSION = '2026-11';
const OAUTH_STATE_TTL_MS = 15 * 60_000;

export type AuthProviderName = 'google' | 'facebook' | 'saml';

export type OAuthUserProfile = {
  provider: AuthProviderName;
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  raw?: Record<string, unknown>;
};

function sanitizeReturnPath(next?: string | null): string {
  if (!next || typeof next !== 'string') return '/app';
  const trimmed = next.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/app';
  }
  return trimmed;
}

function webBaseUrl(env = process.env): string {
  return (
    env.AUTH_OAUTH_REDIRECT_BASE ||
    env.WEB_BASE_URL ||
    env.API_PUBLIC_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

export function authCallbackRedirectUri(
  provider: 'google' | 'facebook' | 'sso',
  env = process.env,
): string {
  if (provider === 'google' && env.GOOGLE_AUTH_REDIRECT_URI?.trim()) {
    return env.GOOGLE_AUTH_REDIRECT_URI.trim();
  }
  if (provider === 'facebook' && env.FACEBOOK_AUTH_REDIRECT_URI?.trim()) {
    return env.FACEBOOK_AUTH_REDIRECT_URI.trim();
  }
  if (provider === 'sso' && env.SSO_REDIRECT_URI?.trim()) {
    return env.SSO_REDIRECT_URI.trim();
  }
  const base = webBaseUrl(env);
  if (provider === 'sso') {
    return `${base}/api/v1/auth/sso/callback`;
  }
  return `${base}/api/v1/auth/oauth/${provider}/callback`;
}

export function getAuthProvidersStatus(env = process.env) {
  const googleConfigured = Boolean(
    env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim(),
  );
  const facebookConfigured = Boolean(
    (env.FACEBOOK_AUTH_CLIENT_ID?.trim() || env.META_APP_ID?.trim()) &&
    (env.FACEBOOK_AUTH_CLIENT_SECRET?.trim() || env.META_APP_SECRET?.trim()),
  );
  const ssoConfigured = Boolean(
    env.SAML_SSO_ENTRY_URL?.trim() || env.SSO_DEFAULT_ENTRY_URL?.trim(),
  );
  return {
    google: { enabled: true, configured: googleConfigured },
    facebook: { enabled: true, configured: facebookConfigured },
    saml: { enabled: true, configured: ssoConfigured },
    terms_version: CURRENT_TERMS_VERSION,
  };
}

export async function startOAuthFlow(
  provider: 'google' | 'facebook',
  opts?: { returnPath?: string; termsAccepted?: boolean; termsVersion?: string },
  env = process.env,
): Promise<{ authorizeUrl: string; state: string }> {
  const status = getAuthProvidersStatus(env);
  if (provider === 'google' && !status.google.configured) {
    throw new DomainError(
      'CONFLICT_STATE',
      'Google Sign-In is not configured on this server yet (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET).',
      409,
      'errors.auth_provider_not_configured',
    );
  }
  if (provider === 'facebook' && !status.facebook.configured) {
    throw new DomainError(
      'CONFLICT_STATE',
      'Facebook Login is not configured on this server yet (set FACEBOOK_AUTH_CLIENT_ID and FACEBOOK_AUTH_CLIENT_SECRET).',
      409,
      'errors.auth_provider_not_configured',
    );
  }

  const state = newId();
  const verifier = provider === 'google' ? pkceVerifier() : null;
  const returnPath = sanitizeReturnPath(opts?.returnPath);
  const termsVersion = opts?.termsAccepted
    ? opts?.termsVersion?.trim() || CURRENT_TERMS_VERSION
    : null;

  await getPrisma().authOAuthState.create({
    data: {
      id: state,
      provider,
      codeVerifier: verifier,
      returnPath,
      termsVersion,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    },
  });

  const redirectUri = authCallbackRedirectUri(provider, env);

  if (provider === 'google') {
    const challenge = pkceChallenge(verifier!);
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!.trim(),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return {
      authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  const fbClientId = (env.FACEBOOK_AUTH_CLIENT_ID || env.META_APP_ID)!.trim();
  const params = new URLSearchParams({
    client_id: fbClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email,public_profile',
    state,
  });
  return {
    authorizeUrl: `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`,
    state,
  };
}

export async function consumeOAuthState(
  stateId: string,
  expectedProvider: string,
): Promise<{
  codeVerifier: string | null;
  returnPath: string;
  termsVersion: string | null;
}> {
  const row = await getPrisma().authOAuthState.findUnique({ where: { id: stateId } });
  if (!row || row.provider !== expectedProvider || row.usedAt || row.expiresAt < new Date()) {
    throw new DomainError(
      'UNAUTHENTICATED',
      'OAuth session expired or invalid',
      401,
      'errors.oauth_state_invalid',
    );
  }
  await getPrisma().authOAuthState.update({
    where: { id: stateId },
    data: { usedAt: new Date() },
  });
  return {
    codeVerifier: row.codeVerifier,
    returnPath: sanitizeReturnPath(row.returnPath),
    termsVersion: row.termsVersion,
  };
}

export async function exchangeOAuthCode(
  provider: 'google' | 'facebook',
  code: string,
  codeVerifier: string | null,
  env = process.env,
): Promise<OAuthUserProfile> {
  const redirectUri = authCallbackRedirectUri(provider, env);

  if (provider === 'google') {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!.trim(),
        client_secret: env.GOOGLE_CLIENT_SECRET!.trim(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }).toString(),
    });
    if (!tokenRes.ok) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Google authentication failed',
        401,
        'errors.oauth_exchange_failed',
      );
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Google access token missing',
        401,
        'errors.oauth_exchange_failed',
      );
    }
    const profileRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'Failed to load Google profile',
        401,
        'errors.oauth_exchange_failed',
      );
    }
    const profile = (await profileRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!profile.sub || !profile.email) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Google account did not return an email address',
        400,
        'errors.oauth_email_required',
      );
    }
    return {
      provider: 'google',
      providerUserId: profile.sub,
      email: profile.email.trim().toLowerCase(),
      name: profile.name?.trim() || profile.email.split('@')[0] || 'User',
      avatarUrl: profile.picture ?? null,
      emailVerified: Boolean(profile.email_verified),
      raw: profile as Record<string, unknown>,
    };
  }

  const fbClientId = (env.FACEBOOK_AUTH_CLIENT_ID || env.META_APP_ID)!.trim();
  const fbSecret = (env.FACEBOOK_AUTH_CLIENT_SECRET || env.META_APP_SECRET)!.trim();
  const tokenParams = new URLSearchParams({
    client_id: fbClientId,
    client_secret: fbSecret,
    redirect_uri: redirectUri,
    code,
  });
  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?${tokenParams.toString()}`,
  );
  if (!tokenRes.ok) {
    throw new DomainError(
      'UNAUTHENTICATED',
      'Facebook authentication failed',
      401,
      'errors.oauth_exchange_failed',
    );
  }
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new DomainError(
      'UNAUTHENTICATED',
      'Facebook access token missing',
      401,
      'errors.oauth_exchange_failed',
    );
  }
  const meParams = new URLSearchParams({
    fields: 'id,name,email,picture.type(large)',
    access_token: tokenData.access_token,
  });
  const meRes = await fetch(`https://graph.facebook.com/v19.0/me?${meParams.toString()}`);
  if (!meRes.ok) {
    throw new DomainError(
      'UNAUTHENTICATED',
      'Failed to load Facebook profile',
      401,
      'errors.oauth_exchange_failed',
    );
  }
  const me = (await meRes.json()) as {
    id?: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string } };
  };
  if (!me.id || !me.email) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Facebook account did not provide an email address',
      400,
      'errors.oauth_email_required',
    );
  }
  return {
    provider: 'facebook',
    providerUserId: me.id,
    email: me.email.trim().toLowerCase(),
    name: me.name?.trim() || me.email.split('@')[0] || 'User',
    avatarUrl: me.picture?.data?.url ?? null,
    emailVerified: true,
    raw: me as Record<string, unknown>,
  };
}

export async function startSsoFlow(
  input: { email?: string; domain?: string; returnPath?: string; termsAccepted?: boolean },
  env = process.env,
): Promise<{ redirectUrl: string; state: string }> {
  const email = input.email?.trim().toLowerCase() ?? '';
  const domain = (
    input.domain?.trim().toLowerCase() || (email.includes('@') ? email.split('@')[1]! : '')
  ).trim();

  if (!domain || !domain.includes('.')) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Enter a valid work email or company domain for SSO',
      400,
      'errors.sso_domain_required',
    );
  }

  const domainConfig = await getPrisma().ssoDomainConfig.findUnique({
    where: { domain },
  });

  const fallbackEntryUrl = (env.SAML_SSO_ENTRY_URL || env.SSO_DEFAULT_ENTRY_URL || '').trim();

  const entryUrl = domainConfig?.enabled ? domainConfig.idpEntryUrl : fallbackEntryUrl;

  if (!entryUrl) {
    throw new DomainError(
      'CONFLICT_STATE',
      `Single Sign-On (SSO) is not configured for "${domain}" yet. Ask your workspace administrator to configure SAML/OIDC SSO for this domain.`,
      409,
      'errors.sso_not_configured',
    );
  }

  const state = newId();
  const returnPath = sanitizeReturnPath(input.returnPath);
  const termsVersion = input.termsAccepted ? CURRENT_TERMS_VERSION : null;

  await getPrisma().authOAuthState.create({
    data: {
      id: state,
      provider: `saml:${domain}`,
      returnPath,
      termsVersion,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    },
  });

  const redirectUri = authCallbackRedirectUri('sso', env);
  const url = new URL(entryUrl);
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', redirectUri);
  if (email) url.searchParams.set('login_hint', email);
  if (domainConfig?.clientId) url.searchParams.set('client_id', domainConfig.clientId);

  return { redirectUrl: url.toString(), state };
}
