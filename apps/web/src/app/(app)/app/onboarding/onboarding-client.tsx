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
    <div className="oma-stack oma-onboarding" data-testid="onboarding">
      <header className="oma-page-header">
        <div>
          <h1>{t('onboarding.title')}</h1>
          <p className="oma-muted">{t('onboarding.subtitle')}</p>
        </div>
      </header>

      {error ? (
        <div className="oma-card" role="alert">
          <p style={{ color: 'var(--status-danger)', margin: 0 }}>{error}</p>
          <Button type="default" onClick={() => setError(null)} style={{ marginTop: 12 }}>
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
        <div className="oma-onboarding-grid" role="group" aria-label={t('onboarding.choices')}>
          <button
            type="button"
            className="oma-onboarding-card"
            onClick={() => setMode('create')}
            data-testid="onboarding-create"
          >
            <h2>{t('onboarding.createTitle')}</h2>
            <p>{t('onboarding.createBody')}</p>
          </button>
          <button
            type="button"
            className="oma-onboarding-card"
            onClick={() => setMode('join')}
            data-testid="onboarding-join"
          >
            <h2>{t('onboarding.joinTitle')}</h2>
            <p>{t('onboarding.joinBody')}</p>
          </button>
        </div>
      ) : null}

      {mode === 'create' ? (
        <form
          className="oma-card oma-stack"
          style={{ maxWidth: 420 }}
          onSubmit={createCompany}
          aria-busy={busy}
        >
          <h2 style={{ margin: 0, fontSize: 'var(--text-title-sm)' }}>
            {t('onboarding.createTitle')}
          </h2>
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
          <div className="oma-row" style={{ gap: 8 }}>
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
        <form
          className="oma-card oma-stack"
          style={{ maxWidth: 420 }}
          onSubmit={joinCompany}
          aria-busy={busy}
        >
          <h2 style={{ margin: 0, fontSize: 'var(--text-title-sm)' }}>
            {t('onboarding.joinTitle')}
          </h2>
          <p className="oma-muted" style={{ margin: 0 }}>
            {t('onboarding.joinHint')}
          </p>
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
          <div className="oma-row" style={{ gap: 8 }}>
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
