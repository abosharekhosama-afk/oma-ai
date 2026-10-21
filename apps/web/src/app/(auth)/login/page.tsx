'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useLocale, useT } from '../../../lib/use-locale';
import { OmaDotsLoader } from '../../../components/ui/oma-dots-loader';
import '../auth-planable.css';

function LoginForm() {
  const t = useT();
  const locale = useLocale();
  const isAr = locale.toLowerCase().startsWith('ar');
  const router = useRouter();
  const search = useSearchParams();
  const nextPath = search.get('next') || '/app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  // Already signed in → go to app (has session cookie)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/auth/me', { credentials: 'include' })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          window.location.replace(nextPath.startsWith('/app') ? nextPath : '/app');
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error?.message ||
            t('auth.loginFailed') ||
            (isAr ? 'فشل تسجيل الدخول' : 'Sign in failed'),
        );
        setSubmitting(false);
        return;
      }
      // Session cookie is set by the API response — hard navigate into the app
      window.location.assign(nextPath.startsWith('/') ? nextPath : '/app');
    } catch {
      setError(t('auth.loginFailed') || (isAr ? 'فشل تسجيل الدخول' : 'Sign in failed'));
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main id="main" className="plx-auth-page">
        <OmaDotsLoader label={isAr ? 'جاري التحقق…' : 'Checking session…'} />
      </main>
    );
  }

  return (
    <main id="main" className="plx-auth-page" data-testid="login-page">
      <div className="plx-auth-card">
        <div className="plx-logo">
          <span className="plx-logo-word">OMA</span>
          <span className="plx-logo-sub">AI</span>
        </div>
        <h1 className="plx-auth-title">{t('auth.login') || (isAr ? 'تسجيل الدخول' : 'Sign in')}</h1>

        <form className="plx-auth-form" onSubmit={onSubmit} noValidate>
          <label className="plx-sr-only" htmlFor="login-email">
            {t('auth.email') || 'Email'}
          </label>
          <input
            id="login-email"
            className="plx-input"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder={t('auth.email') || (isAr ? 'البريد الإلكتروني' : 'Email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <label className="plx-sr-only" htmlFor="login-password">
            {t('auth.password') || 'Password'}
          </label>
          <input
            id="login-password"
            className="plx-input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder={t('auth.password') || (isAr ? 'كلمة المرور' : 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          {error ? (
            <p className="plx-auth-error" role="alert" data-testid="login-error">
              {error}
            </p>
          ) : null}
          <button type="submit" className="plx-btn plx-btn--dark plx-btn--block" disabled={submitting}>
            {submitting ? (
              <OmaDotsLoader label={isAr ? 'جاري الدخول…' : 'Signing in…'} />
            ) : (
              t('auth.login') || (isAr ? 'تسجيل الدخول' : 'Sign in')
            )}
          </button>
        </form>

        <p className="plx-auth-switch">
          {t('auth.needAccount') || (isAr ? 'ليس لديك حساب؟' : 'Need an account?')}{' '}
          <Link href="/register">{t('auth.register') || (isAr ? 'إنشاء حساب' : 'Create account')}</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="plx-auth-page">
          <OmaDotsLoader />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
