'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/use-locale';
import { getProfile, safeReturnPath, setLocaleCookie } from '../../../lib/account-api';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [next, setNext] = useState('/app');

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    setNext(safeReturnPath(qs.get('next')));
    const reason = qs.get('reason');
    if (reason === 'session') setNotice(t('auth.sessionExpiredNotice'));
    else if (reason === 'reset') setNotice(t('auth.reset.done'));
    setReady(true);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      // Apply the account's saved language before entering the app.
      try {
        const profile = await getProfile();
        if (profile.preferred_locale === 'ar' || profile.preferred_locale === 'en') {
          setLocaleCookie(profile.preferred_locale);
        }
      } catch {
        /* non-blocking */
      }
      // Hard navigation so the session cookie from Set-Cookie is present for middleware
      window.location.assign(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="plx-auth-page" dir="ltr" data-auth-ready={ready ? '1' : '0'}>
      <div className="plx-auth-card">
        <PlxLogo sub="by IMKAN" />
        <h1 className="plx-auth-title">{t('auth.login.log_in_to_your_account')}</h1>

        <button type="button" className="plx-btn plx-btn--google plx-btn--block">
          <GoogleIcon /> Continue with Google
        </button>
        <div className="plx-auth-social-row">
          <button type="button" className="plx-btn plx-btn--ghost">
            <FacebookIcon /> Facebook
          </button>
          <button type="button" className="plx-btn plx-btn--ghost">
            <LockIcon /> SAML SSO
          </button>
        </div>

        <div className="plx-divider" aria-hidden="true">
          <span>or</span>
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
              required
              className="plx-input"
              placeholder={t('auth.login.enter_your_password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="plx-eye"
              aria-label={showPassword ? t('auth.login.hide_password') : t('auth.login.show_password')}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {error ? (
            <p role="alert" className="plx-error">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="plx-btn plx-btn--dark plx-btn--block"
            disabled={busy || !ready}
          >
            {busy ? t('auth.login.logging_in') : t('auth.login.log_in')}
          </button>
        </form>

        <p className="plx-auth-link-row">
          <Link href="/forgot-password">{t('auth.login.forgot_your_password')}</Link>
        </p>
        <p className="plx-auth-switch">
          Don&apos;t have an account yet? <Link href="/register">{t('auth.login.get_started')}</Link>
        </p>
      </div>
      <p className="plx-auth-terms">
        By continuing, you agree to our <Link href="/terms">{t('legal.terms.title')}</Link> and{' '}
        <Link href="/privacy">{t('legal.privacy.title')}</Link>.
      </p>
    </main>
  );
}
