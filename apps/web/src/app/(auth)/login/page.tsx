'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useLocale, useT } from '../../../lib/use-locale';
import { getProfile, safeReturnPath, setLocaleCookie } from '../../../lib/account-api';
import {
  CURRENT_TERMS_VERSION,
  saveLocalTermsConsent,
  startOAuthProvider,
  startSsoLogin,
} from '../../../lib/auth-providers-api';
import {
  PlxLogo,
  GoogleIcon,
  FacebookIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
} from '../../../components/ui/plx-icons';
import '../auth-planable.css';

export default function LoginPage() {
  const t = useT();
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [ssoMode, setSsoMode] = useState(false);
  const [ssoDomain, setSsoDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<'google' | 'facebook' | 'sso' | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [next, setNext] = useState('/app');

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setNext(safeReturnPath(qs.get('next')));
    const reason = qs.get('reason');
    if (reason === 'session') setNotice(t('auth.sessionExpiredNotice'));
    else if (reason === 'reset') setNotice(t('auth.reset.done'));
    const oauthErr = qs.get('oauth_error');
    if (oauthErr) {
      setError(t('errors.oauth_exchange_failed'));
    }
    setReady(true);
  }, []);

  async function onOAuthClick(provider: 'google' | 'facebook') {
    setError(null);
    if (!termsAccepted) {
      setError(t('auth.terms.required_error'));
      return;
    }
    setSocialBusy(provider);
    try {
      saveLocalTermsConsent(true);
      const res = await startOAuthProvider(provider, {
        return_path: next,
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION,
      });
      window.location.assign(res.data.authorize_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.auth_provider_not_configured'));
      setSocialBusy(null);
    }
  }

  async function onSsoSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!termsAccepted) {
      setError(t('auth.terms.required_error'));
      return;
    }
    setSocialBusy('sso');
    try {
      saveLocalTermsConsent(true);
      const input = ssoDomain.trim() || email.trim();
      const res = await startSsoLogin({
        email: input.includes('@') ? input : undefined,
        domain: !input.includes('@') ? input : undefined,
        return_path: next,
        terms_accepted: true,
      });
      window.location.assign(res.data.redirect_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.sso_not_configured'));
      setSocialBusy(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!termsAccepted) {
      setError(t('auth.terms.required_error'));
      return;
    }
    setBusy(true);
    try {
      saveLocalTermsConsent(true);
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          terms_accepted: true,
          terms_version: CURRENT_TERMS_VERSION,
          ...(totpCode.trim() ? { totp_code: totpCode.trim() } : {}),
        }),
      });
      try {
        const profile = await getProfile();
        if (profile.preferred_locale === 'ar' || profile.preferred_locale === 'en') {
          setLocaleCookie(profile.preferred_locale);
        }
      } catch {
        /* non-blocking */
      }
      window.location.assign(next);
    } catch (err) {
      const e = err as { code?: string; data?: { error?: { message_key?: string } } };
      if (e?.data?.error?.message_key === 'errors.two_factor_required') {
        setTwoFactorRequired(true);
        setError(t('errors.two_factor_required'));
        return;
      }
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      id="main"
      className="plx-auth-page"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      data-auth-ready={ready ? '1' : '0'}
    >
      <div className="plx-auth-card">
        <PlxLogo sub="by IMKAN" />
        <h1 className="plx-auth-title">
          {ssoMode ? t('auth.sso.title') : t('auth.login.log_in_to_your_account')}
        </h1>

        {!ssoMode ? (
          <>
            <button
              type="button"
              className="plx-btn plx-btn--google plx-btn--block"
              disabled={busy || socialBusy !== null}
              onClick={() => void onOAuthClick('google')}
              data-testid="auth-google-btn"
            >
              <GoogleIcon /> {t('auth.social.continue_google')}
            </button>
            <div className="plx-auth-social-row">
              <button
                type="button"
                className="plx-btn plx-btn--ghost"
                disabled={busy || socialBusy !== null}
                onClick={() => void onOAuthClick('facebook')}
                data-testid="auth-facebook-btn"
              >
                <FacebookIcon /> {t('auth.social.facebook')}
              </button>
              <button
                type="button"
                className="plx-btn plx-btn--ghost"
                disabled={busy || socialBusy !== null}
                onClick={() => {
                  setError(null);
                  setSsoMode(true);
                }}
                data-testid="auth-sso-btn"
              >
                <LockIcon /> {t('auth.social.saml_sso')}
              </button>
            </div>

            <div className="plx-divider" aria-hidden="true">
              <span>{t('auth.social.or')}</span>
            </div>

            {notice ? (
              <p role="status" className="plx-auth-notice" data-testid="login-notice">
                {notice}
              </p>
            ) : null}
            <form className="plx-auth-form" onSubmit={onSubmit}>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-label={t('auth.email')}
                required
                className="plx-input"
                placeholder={t('auth.forgot.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="plx-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-label={t('auth.password')}
                  required
                  className="plx-input"
                  placeholder={t('auth.login.enter_your_password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="plx-eye"
                  aria-label={
                    showPassword ? t('auth.login.hide_password') : t('auth.login.show_password')
                  }
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {twoFactorRequired ? (
                <input
                  id="totp_code"
                  name="totp_code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  className="plx-input oma-ltr"
                  placeholder={t('account.two_factor_code_label') || '6-digit 2FA code'}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.trim())}
                  data-testid="login-totp-input"
                />
              ) : null}

              <label className="plx-terms-consent" data-testid="auth-terms-consent">
                <input
                  type="checkbox"
                  name="terms_accepted"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    saveLocalTermsConsent(e.target.checked);
                    if (e.target.checked) setError(null);
                  }}
                  data-testid="auth-terms-checkbox"
                />
                <span>
                  {t('auth.terms.accept_prefix')}{' '}
                  <Link href="/terms">{t('legal.terms.title')}</Link> {t('auth.terms.and')}{' '}
                  <Link href="/privacy">{t('legal.privacy.title')}</Link>.
                </span>
              </label>

              {error ? (
                <p role="alert" className="plx-error">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="plx-btn plx-btn--dark plx-btn--block"
                disabled={busy || !ready || socialBusy !== null}
              >
                {busy ? t('auth.login.logging_in') : t('auth.login.log_in')}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="plx-auth-sub">{t('auth.sso.subtitle')}</p>
            <form className="plx-auth-form" onSubmit={onSsoSubmit}>
              <input
                id="sso-domain"
                name="sso_domain"
                type="text"
                required
                className="plx-input"
                placeholder={t('auth.sso.placeholder')}
                value={ssoDomain}
                onChange={(e) => setSsoDomain(e.target.value)}
                data-testid="sso-domain-input"
              />
              <label className="plx-terms-consent">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>
                  {t('auth.terms.accept_prefix')}{' '}
                  <Link href="/terms">{t('legal.terms.title')}</Link> {t('auth.terms.and')}{' '}
                  <Link href="/privacy">{t('legal.privacy.title')}</Link>.
                </span>
              </label>
              {error ? (
                <p role="alert" className="plx-error">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="plx-btn plx-btn--dark plx-btn--block"
                disabled={socialBusy === 'sso'}
              >
                {t('auth.sso.continue')}
              </button>
            </form>
            <button
              type="button"
              className="plx-auth-back"
              onClick={() => {
                setError(null);
                setSsoMode(false);
              }}
            >
              {t('auth.sso.cancel')}
            </button>
          </>
        )}

        <p className="plx-auth-link-row">
          <Link href="/forgot-password">{t('auth.login.forgot_your_password')}</Link>
        </p>
        <p className="plx-auth-switch">
          {t('auth.needAccount')}{' '}
          <Link href={next !== '/app' ? `/register?next=${encodeURIComponent(next)}` : '/register'}>
            {t('auth.login.get_started')}
          </Link>
        </p>
      </div>
      <p className="plx-auth-terms">
        <Link href="/terms">{t('legal.terms.title')}</Link> ·{' '}
        <Link href="/privacy">{t('legal.privacy.title')}</Link>
      </p>
    </main>
  );
}
