'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '../../../../lib/api';
import { useT } from '../../../../lib/use-locale';

export default function OnboardingClient() {
  const t = useT();
  const router = useRouter();
  const search = useSearchParams();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const invite = search.get('invite');
    if (invite) {
      setToken(invite);
      setMode('join');
    }
  }, [search]);

  async function createCompany(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/v1/tenants', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setStatus(t('onboarding.createSuccess'));
      router.replace('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function joinCompany(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/v1/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() }),
      });
      setStatus(t('onboarding.joinSuccess'));
      router.replace('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="oma-stack">
      <header className="oma-page-header">
        <div>
          <h1>{t('onboarding.title')}</h1>
          <p className="oma-muted">{t('onboarding.subtitle')}</p>
        </div>
      </header>

      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
          <button type="button" className="oma-btn oma-btn-secondary" onClick={() => setError(null)}>
            {t('common.retry')}
          </button>
        </div>
      ) : null}
      {status ? (
        <p role="status" className="oma-muted">
          {status}
        </p>
      ) : null}

      {mode === 'choose' ? (
        <div className="oma-action-grid" role="group" aria-label={t('onboarding.choices')}>
          <button type="button" className="oma-card oma-card-button" onClick={() => setMode('create')}>
            <h2>{t('onboarding.createTitle')}</h2>
            <p className="oma-muted">{t('onboarding.createBody')}</p>
          </button>
          <button type="button" className="oma-card oma-card-button" onClick={() => setMode('join')}>
            <h2>{t('onboarding.joinTitle')}</h2>
            <p className="oma-muted">{t('onboarding.joinBody')}</p>
          </button>
        </div>
      ) : null}

      {mode === 'create' ? (
        <form className="oma-card oma-stack" onSubmit={createCompany} aria-busy={busy}>
          <h2>{t('onboarding.createTitle')}</h2>
          <label className="oma-field">
            <span>{t('onboarding.companyName')}</span>
            <input
              className="oma-input"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </label>
          <div className="oma-row">
            <button type="submit" className="oma-btn" disabled={busy}>
              {busy ? t('common.loading') : t('onboarding.createSubmit')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              disabled={busy}
              onClick={() => setMode('choose')}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'join' ? (
        <form className="oma-card oma-stack" onSubmit={joinCompany} aria-busy={busy}>
          <h2>{t('onboarding.joinTitle')}</h2>
          <p className="oma-muted">{t('onboarding.joinHint')}</p>
          <label className="oma-field">
            <span>{t('onboarding.inviteToken')}</span>
            <input
              className="oma-input"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              autoFocus
              autoComplete="off"
            />
          </label>
          <div className="oma-row">
            <button type="submit" className="oma-btn" disabled={busy}>
              {busy ? t('common.loading') : t('onboarding.joinSubmit')}
            </button>
            <button
              type="button"
              className="oma-btn oma-btn-secondary"
              disabled={busy}
              onClick={() => setMode('choose')}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
