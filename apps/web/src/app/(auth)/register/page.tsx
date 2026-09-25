'use client';
import { Button, Input, PasswordInput } from '@oma/ui/controls';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/use-locale';

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="oma-auth">
      <div className="oma-auth-brand">
        <span className="oma-rail-mark" aria-hidden="true">
          OMA
        </span>
        <strong>{t('app.name')}</strong>
      </div>
      <h1>{t('auth.register')}</h1>
      <form className="oma-card" onSubmit={onSubmit}>
        <label htmlFor="name">{t('auth.name')}</label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
        />
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
          autoComplete="new-password"
          required
        />
        {error ? (
          <p role="alert" style={{ color: 'var(--status-danger)' }}>
            {error}
          </p>
        ) : null}
        <Button type="primary" disabled={busy} htmlType="submit">
          {t('auth.register')}
        </Button>
      </form>
      <p className="oma-muted">
        {t('auth.haveAccount')} <Link href="/login">{t('auth.login')}</Link>
      </p>
    </main>
  );
}
