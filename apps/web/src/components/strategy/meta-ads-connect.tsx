'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { getApiError } from '../../lib/brand-api';
import { useT } from '../../lib/use-locale';

type Status = {
  mode: 'disabled' | 'fixture' | 'live';
  status: string;
  ad_account_id: string | null;
  ad_account_name: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

/** DEC-029 4.8: read-only Meta Ads connection (ads_read) feeding paid pacing. */
export function MetaAdsConnect({ brandId, onSynced }: { brandId: string; onSynced: () => void }) {
  const t = useT();
  const base = `/api/v1/brands/${brandId}/meta-ads`;
  const [status, setStatus] = useState<Status | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; currency: string }>>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void api<{ data: Status }>(base)
      .then((r) => {
        setStatus(r.data);
        if (
          r.data.status === 'PENDING_ACCOUNT' ||
          (r.data.status === 'FIXTURE' && !r.data.ad_account_id)
        ) {
          void api<{ data: Array<{ id: string; name: string; currency: string }> }>(
            `${base}/accounts`,
          )
            .then((a) => setAccounts(a.data))
            .catch(() => undefined);
        }
      })
      .catch(() => setStatus(null));
  }, [base]);
  useEffect(() => load(), [load]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(getApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  if (!status || status.mode === 'disabled') return null;
  const connected =
    status.status === 'CONNECTED' || (status.status === 'FIXTURE' && status.ad_account_id);
  return (
    <div className="oma-callout" data-testid="meta-ads-connect">
      <strong>{t('strategy.metaAds.title')}</strong>{' '}
      <span className="oma-muted">{t('strategy.metaAds.readOnly')}</span>
      {status.mode === 'fixture' ? <span className="oma-muted"> · FIXTURE</span> : null}
      {error ? <p role="alert">{error}</p> : null}
      {status.status === 'NEEDS_RECONNECT' ? (
        <p role="alert">{t('strategy.metaAds.reconnect')}</p>
      ) : null}
      {connected ? (
        <p>
          {status.ad_account_name} ·{' '}
          {status.last_sync_at
            ? `${t('strategy.metaAds.lastSync')}: ${new Date(status.last_sync_at).toLocaleString()}`
            : t('strategy.metaAds.neverSynced')}
        </p>
      ) : null}
      <div className="oma-chip-row">
        {status.status === 'NOT_CONNECTED' || status.status === 'NEEDS_RECONNECT' ? (
          <button
            type="button"
            className="oma-btn oma-btn--secondary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const r = await api<{ data: { authorize_url?: string } }>(`${base}/oauth/start`, {
                  method: 'POST',
                  body: '{}',
                });
                if (r.data.authorize_url) window.location.assign(r.data.authorize_url);
              })
            }
          >
            {t('strategy.metaAds.connect')}
          </button>
        ) : null}
        {!connected && accounts.length ? (
          <select
            className="oma-input"
            aria-label={t('strategy.metaAds.pickAccount')}
            defaultValue=""
            disabled={busy}
            onChange={(e) =>
              void act(async () => {
                await api(`${base}/account`, {
                  method: 'POST',
                  body: JSON.stringify({ ad_account_id: e.target.value }),
                });
              })
            }
          >
            <option value="" disabled>
              {t('strategy.metaAds.pickAccount')}
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        ) : null}
        {connected ? (
          <button
            type="button"
            className="oma-btn oma-btn--secondary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await api(`${base}/sync`, { method: 'POST', body: JSON.stringify({ days: 28 }) });
                onSynced();
              })
            }
          >
            {t('strategy.metaAds.sync')}
          </button>
        ) : null}
        {status.status !== 'NOT_CONNECTED' ? (
          <button
            type="button"
            className="oma-btn oma-btn--ghost"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await api(`${base}/disconnect`, { method: 'POST', body: '{}' });
              })
            }
          >
            {t('strategy.metaAds.disconnect')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
