'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { confirmPasswordReset } from '../../../lib/account-api';
import { useLocale, useT } from '../../../lib/use-locale';
import { PlxLogo } from '../../../components/ui/plx-icons';
import '../auth-planable.css';

export default function ResetPasswordPage() {
  const t = useT();
  const locale = useLocale();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(token, password);
      window.location.assign('/login?reason=reset');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) setError(t('auth.reset.invalid'));
      else if (status === 400) setError(t('auth.reset.weak'));
      else setError(t('auth.reset.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="plx-auth-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="plx-auth-card">
        <PlxLogo sub="by IMKAN" />
        <h1 className="plx-auth-title">{t('auth.reset.title')}</h1>
        {!token ? (
          <p role="alert" className="plx-error">
            {t('auth.reset.invalid')}
          </p>
        ) : (
          <form className="plx-auth-form" onSubmit={onSubmit}>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="plx-input"
              placeholder={t('auth.reset.newPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              required
              className="plx-input"
              placeholder={t('auth.reset.confirmPassword')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {error ? (
              <p role="alert" className="plx-error">
                {error}
              </p>
            ) : null}
            <button type="submit" className="plx-btn plx-btn--dark plx-btn--block" disabled={busy}>
              {busy ? t('auth.reset.saving') : t('auth.reset.submit')}
            </button>
          </form>
        )}
        <p className="plx-auth-link-row">
          <Link href="/forgot-password">{t('auth.reset.requestNew')}</Link>
        </p>
      </div>
    </main>
  );
}
