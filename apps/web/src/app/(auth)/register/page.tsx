'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { useT } from '../../../lib/use-locale';
import { OmaDotsLoader } from '../../../components/ui/oma-dots-loader';
import {
  PlxLogo, GoogleIcon, FacebookIcon, LockIcon, EyeIcon, EyeOffIcon,
} from '../../../components/ui/plx-icons';
import '../auth-planable.css';

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function continueToStepTwo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid work email address');
      return;
    }
    setStep(2);
  }

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
    <main id="main" className="plx-auth-page" dir="ltr">
      <div className="plx-auth-card">
        <PlxLogo sub="by IMKAN" />
        {step === 1 ? (
          <>
            <h1 className="plx-auth-title">Start with 50 free posts</h1>
            <p className="plx-auth-sub">No credit card required.</p>

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

            <form className="plx-auth-form" onSubmit={continueToStepTwo}>
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
              {error ? (
                <p role="alert" className="plx-error">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="plx-btn plx-btn--dark plx-btn--block">
                Continue
              </button>
            </form>

            <p className="plx-auth-switch">
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="plx-auth-title">Create your account</h1>
            <form className="plx-auth-form" onSubmit={onSubmit}>
              <input
                id="name"
                name="name"
                autoComplete="name"
                required
                className="plx-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="plx-input-wrap">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className="plx-input"
                  placeholder="Create a password"
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
              <button type="submit" className="plx-btn plx-btn--dark plx-btn--block" disabled={busy}>
                {busy ? <OmaDotsLoader label="Creating account" /> : 'Create account'}
              </button>
            </form>
            <button type="button" className="plx-auth-back" onClick={() => setStep(1)}>
              Back
            </button>
          </>
        )}
      </div>
      <p className="plx-auth-terms">
        By continuing, you agree to our <a href="#">Terms of Service</a> and{' '}
        <a href="#">Privacy Policy</a>.
      </p>
    </main>
  );
}
