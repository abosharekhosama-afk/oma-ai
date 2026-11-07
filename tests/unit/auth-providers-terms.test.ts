import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CURRENT_TERMS_VERSION,
  authCallbackRedirectUri,
  getAuthProvidersStatus,
} from '../../apps/api/src/identity/oauth-providers.service';

describe('Auth providers (Google, Facebook, SAML SSO) and Terms consent', () => {
  it('reports provider readiness and current terms version from env', () => {
    const unconfigured = getAuthProvidersStatus({});
    expect(unconfigured.google.configured).toBe(false);
    expect(unconfigured.facebook.configured).toBe(false);
    expect(unconfigured.saml.configured).toBe(false);
    expect(unconfigured.terms_version).toBe(CURRENT_TERMS_VERSION);

    const configured = getAuthProvidersStatus({
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'gsec',
      FACEBOOK_AUTH_CLIENT_ID: 'fbid',
      FACEBOOK_AUTH_CLIENT_SECRET: 'fbsec',
      SAML_SSO_ENTRY_URL: 'https://idp.example.com/sso',
    });
    expect(configured.google.configured).toBe(true);
    expect(configured.facebook.configured).toBe(true);
    expect(configured.saml.configured).toBe(true);
  });

  it('computes canonical callback redirect URIs for google, facebook, and sso', () => {
    const env = { WEB_BASE_URL: 'https://oma.imkan.ai/' };
    expect(authCallbackRedirectUri('google', env)).toBe(
      'https://oma.imkan.ai/api/v1/auth/oauth/google/callback',
    );
    expect(authCallbackRedirectUri('facebook', env)).toBe(
      'https://oma.imkan.ai/api/v1/auth/oauth/facebook/callback',
    );
    expect(authCallbackRedirectUri('sso', env)).toBe(
      'https://oma.imkan.ai/api/v1/auth/sso/callback',
    );
  });

  it('wires OAuth/SSO routes and terms acceptance into AuthController and login/register UI', () => {
    const controller = readFileSync(resolve('apps/api/src/identity/auth.controller.ts'), 'utf8');
    expect(controller).toContain("@Get('providers')");
    expect(controller).toContain("@Post('oauth/:provider/start')");
    expect(controller).toContain("@Get('oauth/:provider/callback')");
    expect(controller).toContain("@Post('sso/start')");
    expect(controller).toContain("@Get('sso/callback')");
    expect(controller).toContain("@Post('terms/accept')");

    const loginPage = readFileSync(resolve('apps/web/src/app/(auth)/login/page.tsx'), 'utf8');
    expect(loginPage).toContain('auth-google-btn');
    expect(loginPage).toContain('auth-facebook-btn');
    expect(loginPage).toContain('auth-sso-btn');
    expect(loginPage).toContain('auth-terms-checkbox');

    const registerPage = readFileSync(resolve('apps/web/src/app/(auth)/register/page.tsx'), 'utf8');
    expect(registerPage).toContain('auth-terms-checkbox');
    expect(registerPage).toContain('terms_accepted: true');
  });
});
