'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '../../../lib/account-api';
import { useLocale, useT } from '../../../lib/use-locale';
import { PlxLogo } from '../../../components/ui/plx-icons';
import '../auth-planable.css';

export default function ForgotPasswordPage() {
  const t = useT();
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError(t('auth.forgot.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="plx-auth-page" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="plx-auth-card">
        <PlxLogo sub="by IMKAN" />
        <h1 className="plx-auth-title">{t('auth.forgot.title')}</h1>
        {sent ? (
          <p role="status" className="plx-auth-notice" data-testid="forgot-sent">
            {t('auth.forgot.sent')}
          </p>
        ) : (
          <form className="plx-auth-form" onSubmit={onSubmit}>
            <p className="plx-auth-hint">{t('auth.forgot.body')}</p>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="plx-input"
              placeholder={t('auth.forgot.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error ? (
              <p role="alert" className="plx-error">
                {error}
              </p>
            ) : null}
            <button type="submit" className="plx-btn plx-btn--dark plx-btn--block" disabled={busy}>
              {busy ? t('auth.forgot.sending') : t('auth.forgot.submit')}
            </button>
          </form>
        )}
        <p className="plx-auth-link-row">
          <Link href="/login">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </main>
  );
}
