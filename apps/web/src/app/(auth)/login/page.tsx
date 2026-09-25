'use client';
import { Button, Input, PasswordInput } from '@oma/ui/controls';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/use-locale';

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="oma-auth" data-auth-ready={ready ? '1' : '0'}>
      <div className="oma-auth-brand">
        <span className="oma-rail-mark" aria-hidden="true">
          OMA
        </span>
        <strong>{t('app.name')}</strong>
      </div>
      <h1>{t('auth.login')}</h1>
      <form className="oma-card" method="post" action="/login" onSubmit={onSubmit}>
        <label htmlFor="email">{t('auth.email')}</label>
        <Input
          id="email"
          name="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          type="email"
        />
        <label htmlFor="password">{t('auth.password')}</label>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {error}
          </p>
        ) : null}
        <Button type="primary" disabled={busy || !ready} htmlType="submit">
          {t('auth.login')}
        </Button>
      </form>
      <p className="oma-muted">
        {t('auth.needAccount')} <Link href="/register">{t('auth.register')}</Link>
      </p>
    </main>
  );
}
