'use client';

import { FormEvent, useState } from 'react';
import { useLocale, useT } from '../../../lib/use-locale';
import { api } from '../../../lib/api';
import { PlxLogo } from '../../../components/ui/plx-icons';
import '../auth-planable.css';

type Mode = 'register' | 'login';

export default function InviteAcceptance({ token }: { token: string }) {
  const t = useT();
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function acceptInvitation() {
    await api('/api/v1/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token: token.trim() }),
    });
    window.location.assign('/app');
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!token.trim()) {
      setError(t('errors.not_found'));
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        await api('/api/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
        });
      }
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await acceptInvitation();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.invite_failed'));
      setBusy(false);
    }
  }

  return (
    <main
      id="main"
      className="plx-auth-page"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      data-testid="invite-acceptance"
    >
      <div className="plx-auth-card">
        <PlxLogo sub="by IMKAN" />
        <h1 className="plx-auth-title">{t('onboarding.joinTitle')}</h1>
        <p className="plx-auth-sub">{t('onboarding.joinHint')}</p>
        {!token ? (
          <p className="plx-error" role="alert">
            {t('errors.not_found')}
          </p>
        ) : (
          <>
            <div className="plx-auth-social-row" role="group" aria-label={t('onboarding.choices')}>
              <button
                type="button"
                className={`plx-btn ${mode === 'register' ? 'plx-btn--dark' : 'plx-btn--ghost'}`}
                aria-pressed={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
              >
                {t('auth.register')}
              </button>
              <button
                type="button"
                className={`plx-btn ${mode === 'login' ? 'plx-btn--dark' : 'plx-btn--ghost'}`}
                aria-pressed={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
              >
                {t('auth.login.log_in')}
              </button>
            </div>
            <form className="plx-auth-form" onSubmit={onSubmit} aria-busy={busy}>
              {mode === 'register' ? (
                <input
                  name="name"
                  autoComplete="name"
                  required
                  className="plx-input"
                  aria-label={t('auth.register.your_name')}
                  placeholder={t('auth.register.your_name')}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={busy}
                />
              ) : null}
              <input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                className="plx-input"
                aria-label={t('auth.forgot.emailPlaceholder')}
                placeholder={t('auth.forgot.emailPlaceholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
              <input
                name="password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
                className="plx-input"
                aria-label={
                  mode === 'register'
                    ? t('auth.register.create_a_password')
                    : t('auth.login.enter_your_password')
                }
                placeholder={
                  mode === 'register'
                    ? t('auth.register.create_a_password')
                    : t('auth.login.enter_your_password')
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
              {error ? (
                <p className="plx-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="plx-btn plx-btn--dark plx-btn--block"
                disabled={busy}
              >
                {busy
                  ? t('common.loading')
                  : mode === 'register'
                    ? t('onboarding.joinSubmit')
                    : t('auth.login.log_in')}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
