'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { safeReturnPath } from '../../../lib/account-api';
import { useLocale, useT } from '../../../lib/use-locale';
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

export default function RegisterPage() {
  const t = useT();
  const locale = useLocale();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [ssoMode, setSsoMode] = useState(false);
  const [ssoDomain, setSsoDomain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<'google' | 'facebook' | 'sso' | null>(null);

  function getNextPath() {
    if (typeof window === 'undefined') return '/app';
    return safeReturnPath(new URLSearchParams(window.location.search).get('next'));
  }

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
        return_path: getNextPath(),
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
        return_path: getNextPath(),
        terms_accepted: true,
      });
      window.location.assign(res.data.redirect_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.sso_not_configured'));
      setSocialBusy(null);
    }
  }

  function continueToStepTwo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!termsAccepted) {
      setError(t('auth.terms.required_error'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('auth.register.please_enter_a_valid_work'));
      return;
    }
    setStep(2);
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
      await api('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          terms_accepted: true,
          terms_version: CURRENT_TERMS_VERSION,
        }),
      });
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          terms_accepted: true,
          terms_version: CURRENT_TERMS_VERSION,
        }),
      });
      window.location.assign(getNextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="plx-auth-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="plx-auth-card">
        <PlxLogo sub="by IMKAN" />
        {ssoMode ? (
          <>
            <h1 className="plx-auth-title">{t('auth.sso.title')}</h1>
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
        ) : step === 1 ? (
          <>
            <h1 className="plx-auth-title">{t('auth.register.start_with_50_free_posts')}</h1>
            <p className="plx-auth-sub">{t('auth.register.no_credit_card_required')}</p>

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

            <form className="plx-auth-form" onSubmit={continueToStepTwo}>
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
              <button type="submit" className="plx-btn plx-btn--dark plx-btn--block">
                {t('auth.register.continue')}
              </button>
            </form>

            <p className="plx-auth-switch">
              {t('auth.haveAccount')} <Link href="/login">{t('auth.login.log_in')}</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="plx-auth-title">{t('auth.register.create_your_account')}</h1>
            <form className="plx-auth-form" onSubmit={onSubmit}>
              <input
                id="name"
                name="name"
                autoComplete="name"
                aria-label={t('auth.name')}
                required
                className="plx-input"
                placeholder={t('auth.register.your_name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="plx-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-label={t('auth.password')}
                  required
                  className="plx-input"
                  placeholder={t('auth.register.create_a_password')}
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
              <label className="plx-terms-consent" data-testid="auth-terms-consent-step2">
                <input
                  type="checkbox"
                  name="terms_accepted"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    saveLocalTermsConsent(e.target.checked);
                    if (e.target.checked) setError(null);
                  }}
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
                disabled={busy}
              >
                {busy ? t('auth.register.creating_account') : t('auth.register')}
              </button>
            </form>
            <button type="button" className="plx-auth-back" onClick={() => setStep(1)}>
              {t('auth.register.back')}
            </button>
          </>
        )}
      </div>
      <p className="plx-auth-terms">
        <Link href="/terms">{t('legal.terms.title')}</Link> ·{' '}
        <Link href="/privacy">{t('legal.privacy.title')}</Link>
      </p>
    </main>
  );
}
