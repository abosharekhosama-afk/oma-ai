'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useLocale, useT } from '../../../lib/use-locale';
import { OmaDotsLoader } from '../../../components/ui/oma-dots-loader';
import '../auth-planable.css';

export default function RegisterPage() {
  const t = useT();
  const locale = useLocale();
  const isAr = locale.toLowerCase().startsWith('ar');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data?.error?.message ||
            t('auth.registerFailed') ||
            (isAr ? 'تعذر إنشاء الحساب' : 'Could not create the account'),
        );
        setSubmitting(false);
        return;
      }
      // After register, go select company (may need login if register does not set session)
      // Auth controller register does NOT set session cookie — only returns user.
      // Sign in next, or login after register.
      const loginRes = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (loginRes.ok) {
        window.location.assign('/app/select-company');
        return;
      }
      window.location.assign('/login');
    } catch {
      setError(
        t('auth.registerFailed') || (isAr ? 'تعذر إنشاء الحساب' : 'Could not create the account'),
      );
      setSubmitting(false);
    }
  }

  return (
    <main id="main" className="plx-auth-page" data-testid="register-page">
      <div className="plx-auth-card">
        <div className="plx-logo">
          <span className="plx-logo-word">OMA</span>
          <span className="plx-logo-sub">AI</span>
        </div>
        <h1 className="plx-auth-title">
          {t('auth.register') || (isAr ? 'إنشاء حساب' : 'Create account')}
        </h1>

        <form className="plx-auth-form" onSubmit={onSubmit} noValidate>
          <label className="plx-sr-only" htmlFor="reg-name">
            {t('auth.name') || 'Name'}
          </label>
          <input
            id="reg-name"
            className="plx-input"
            type="text"
            name="name"
            autoComplete="name"
            required
            placeholder={t('auth.name') || (isAr ? 'الاسم' : 'Name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
          <label className="plx-sr-only" htmlFor="reg-email">
            {t('auth.email') || 'Email'}
          </label>
          <input
            id="reg-email"
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
          <label className="plx-sr-only" htmlFor="reg-password">
            {t('auth.password') || 'Password'}
          </label>
          <input
            id="reg-password"
            className="plx-input"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder={t('auth.password') || (isAr ? 'كلمة المرور' : 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          {error ? (
            <p className="plx-auth-error" role="alert" data-testid="register-error">
              {error}
            </p>
          ) : null}
          <button type="submit" className="plx-btn plx-btn--dark plx-btn--block" disabled={submitting}>
            {submitting ? (
              <OmaDotsLoader label={isAr ? 'جاري الإنشاء…' : 'Creating…'} />
            ) : (
              t('auth.register') || (isAr ? 'إنشاء حساب' : 'Create account')
            )}
          </button>
        </form>

        <p className="plx-auth-switch">
          {t('auth.haveAccount') || (isAr ? 'لديك حساب بالفعل؟' : 'Already have an account?')}{' '}
          <Link href="/login">{t('auth.login') || (isAr ? 'تسجيل الدخول' : 'Sign in')}</Link>
        </p>
      </div>
    </main>
  );
}
