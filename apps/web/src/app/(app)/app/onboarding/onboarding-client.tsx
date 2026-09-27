'use client';
import { Button, Input } from '@oma/ui/controls';

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
          <Button type="default" onClick={() => setError(null)}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}
      {status ? (
        <p role="status" className="oma-muted">
          {status}
        </p>
      ) : null}

      {mode === 'choose' ? (
        <div className="oma-action-grid" role="group" aria-label={t('onboarding.choices')}>
          <Button
            type="default"
            onClick={() => setMode('create')}
            className="oma-card"
            style={{ height: 'auto', whiteSpace: 'normal', textAlign: 'start' }}
          >
            <h2>{t('onboarding.createTitle')}</h2>
            <p className="oma-muted">{t('onboarding.createBody')}</p>
          </Button>
          <Button
            type="default"
            onClick={() => setMode('join')}
            className="oma-card"
            style={{ height: 'auto', whiteSpace: 'normal', textAlign: 'start' }}
          >
            <h2>{t('onboarding.joinTitle')}</h2>
            <p className="oma-muted">{t('onboarding.joinBody')}</p>
          </Button>
        </div>
      ) : null}

      {mode === 'create' ? (
        <form className="oma-card oma-stack" onSubmit={createCompany} aria-busy={busy}>
          <h2>{t('onboarding.createTitle')}</h2>
          <label className="oma-field">
            <span>{t('onboarding.companyName')}</span>
            <Input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </label>
          <div className="oma-row">
            <Button type="primary" disabled={busy} htmlType="submit">
              {busy ? t('common.loading') : t('onboarding.createSubmit')}
            </Button>
            <Button type="default" disabled={busy} onClick={() => setMode('choose')}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      {mode === 'join' ? (
        <form className="oma-card oma-stack" onSubmit={joinCompany} aria-busy={busy}>
          <h2>{t('onboarding.joinTitle')}</h2>
          <p className="oma-muted">{t('onboarding.joinHint')}</p>
          <label className="oma-field">
            <span>{t('onboarding.inviteToken')}</span>
            <Input
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              autoFocus
              autoComplete="off"
            />
          </label>
          <div className="oma-row">
            <Button type="primary" disabled={busy} htmlType="submit">
              {busy ? t('common.loading') : t('onboarding.joinSubmit')}
            </Button>
            <Button type="default" disabled={busy} onClick={() => setMode('choose')}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
