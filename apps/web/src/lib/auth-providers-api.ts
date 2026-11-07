import { api } from './api';

export const CURRENT_TERMS_VERSION = '2026-11';
export const TERMS_STORAGE_KEY = 'oma.terms.accepted.v2026_11';

export type AuthProvidersStatus = {
  google: { enabled: boolean; configured: boolean };
  facebook: { enabled: boolean; configured: boolean };
  saml: { enabled: boolean; configured: boolean };
  terms_version: string;
};

export function getAuthProviders() {
  return api<{ data: AuthProvidersStatus }>('/api/v1/auth/providers');
}

export function startOAuthProvider(
  provider: 'google' | 'facebook',
  opts: { return_path?: string; terms_accepted: boolean; terms_version?: string },
) {
  return api<{ data: { authorize_url: string; state: string } }>(
    `/api/v1/auth/oauth/${provider}/start`,
    {
      method: 'POST',
      body: JSON.stringify({
        return_path: opts.return_path,
        terms_accepted: opts.terms_accepted,
        terms_version: opts.terms_version ?? CURRENT_TERMS_VERSION,
      }),
    },
  );
}

export function startSsoLogin(opts: {
  email?: string;
  domain?: string;
  return_path?: string;
  terms_accepted: boolean;
}) {
  return api<{ data: { redirect_url: string; state: string } }>('/api/v1/auth/sso/start', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export function recordTermsAcceptance(termsVersion = CURRENT_TERMS_VERSION) {
  return api<{
    data: {
      terms_accepted_at: string;
      terms_version: string;
      privacy_accepted_at: string;
    };
  }>('/api/v1/auth/terms/accept', {
    method: 'POST',
    body: JSON.stringify({ terms_version: termsVersion }),
  });
}

export function saveLocalTermsConsent(accepted: boolean) {
  try {
    if (typeof window === 'undefined') return;
    if (accepted) {
      window.localStorage.setItem(
        TERMS_STORAGE_KEY,
        JSON.stringify({
          accepted: true,
          version: CURRENT_TERMS_VERSION,
          at: new Date().toISOString(),
        }),
      );
    } else {
      window.localStorage.removeItem(TERMS_STORAGE_KEY);
    }
  } catch {
    /* ignore storage errors */
  }
}
