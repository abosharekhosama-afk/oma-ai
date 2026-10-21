'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/use-locale';
import { OmaDotsLoader } from '../../../components/ui/oma-dots-loader';
import {
  PlxLogo, GoogleIcon, FacebookIcon, LockIcon, EyeIcon, EyeOffIcon,
} from '../../../components/ui/plx-icons';
import '../auth-planable.css';

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <main id="main" className="plx-auth-page" dir="ltr" data-auth-ready={ready ? '1' : '0'}>
      <div className="plx-auth-card">
        <PlxLogo sub="by IMKAN" />
        <h1 className="plx-auth-title">Log in to your account</h1>

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

        <form className="plx-auth-form" onSubmit={onSubmit}>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            className="plx-input"
            placeholder="Enter your work email address"
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
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="plx-eye"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
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
          <button type="submit" className="plx-btn plx-btn--dark plx-btn--block" disabled={busy || !ready}>
            {busy ? <OmaDotsLoader label="Logging in" /> : 'Log in'}
          </button>
        </form>

        <p className="plx-auth-link-row">
          <Link href="#">Forgot your password?</Link>
        </p>
        <p className="plx-auth-switch">
          Don&apos;t have an account yet? <Link href="/register">Get started</Link>
        </p>
      </div>
      <p className="plx-auth-terms">
        By continuing, you agree to our <a href="#">Terms of Service</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </p>
    </main>
  );
}
