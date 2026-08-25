'use client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }
  return (
    <main id="main" className="oma-container" style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <form className="oma-card" onSubmit={onSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          className="oma-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className="oma-input"
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
        <button className="oma-btn" type="submit">
          Sign in
        </button>
      </form>
      <p>
        <Link href="/register">Create account</Link>
      </p>
    </main>
  );
}
