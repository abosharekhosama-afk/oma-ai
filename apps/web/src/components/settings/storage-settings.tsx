'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiError } from '../../lib/brand-api';
import {
  formatBytes,
  workDriveApi,
  type StorageMode,
  type WorkspaceStorage,
} from '../../lib/workdrive-api';
import { WorkDriveSettings } from './workdrive-settings';

type Tr = (key: string) => string;

const MODES: StorageMode[] = ['OMA_INTERNAL', 'USER_WORKDRIVE', 'SYNC_BACKUP'];

const MODE_COPY: Record<StorageMode, { title: string; desc: string }> = {
  OMA_INTERNAL: { title: 'storage.mode.internal.title', desc: 'storage.mode.internal.desc' },
  USER_WORKDRIVE: { title: 'storage.mode.byos.title', desc: 'storage.mode.byos.desc' },
  SYNC_BACKUP: { title: 'storage.mode.sync.title', desc: 'storage.mode.sync.desc' },
};

export function StorageSettings({
  t,
  locale,
  canManage,
}: {
  t: Tr;
  locale: string;
  canManage: boolean;
}) {
  const [storage, setStorage] = useState<WorkspaceStorage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<StorageMode | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    workDriveApi
      .storage()
      .then((r) => setStorage(r.data))
      .catch((e) => setLoadError(getApiError(e).message));
  }, []);
  useEffect(load, [load]);

  if (!canManage) {
    return (
      <section className="oma-bs-card" data-testid="storage-settings">
        <h2 className="oma-bs-card__title">{t('storage.title')}</h2>
        <p className="oma-bs-card__desc">{t('storage.adminOnly')}</p>
      </section>
    );
  }
  if (loadError) {
    return (
      <section className="oma-bs-card" data-testid="storage-settings">
        <h2 className="oma-bs-card__title">{t('storage.title')}</h2>
        <p className="oma-bs-notice oma-bs-notice--error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }
  if (!storage) return <div className="oma-bs-card oma-wd-skeleton" aria-busy="true" />;

  const byosWorking = storage.byos_connected && storage.byos_status !== 'ERROR';
  const enabled: Record<StorageMode, boolean> = {
    OMA_INTERNAL: storage.internal_available,
    USER_WORKDRIVE: byosWorking,
    SYNC_BACKUP: storage.internal_available && byosWorking,
  };
  const reason: Record<StorageMode, string | null> = {
    OMA_INTERNAL: storage.internal_available ? null : t('storage.needInternal'),
    USER_WORKDRIVE: byosWorking ? null : t('storage.needByos'),
    SYNC_BACKUP: storage.internal_available && byosWorking ? null : t('storage.needBoth'),
  };

  const pick = async (mode: StorageMode) => {
    if (mode === storage.mode || !enabled[mode] || busy) return;
    setBusy(mode);
    setNotice(null);
    try {
      const r = await workDriveApi.setMode(mode);
      setStorage(r.data);
      setNotice({ kind: 'success', text: t('storage.switched') });
    } catch (e) {
      setNotice({ kind: 'error', text: getApiError(e).message });
    } finally {
      setBusy(null);
    }
  };

  const usedLabel =
    storage.limit_bytes == null
      ? `${formatBytes(storage.used_bytes, locale)} · ${t('storage.usage.unlimited')}`
      : t('storage.usage.of')
          .replace('{used}', formatBytes(storage.used_bytes, locale))
          .replace('{limit}', formatBytes(storage.limit_bytes, locale));
  const pct =
    storage.limit_bytes && storage.limit_bytes > 0
      ? Math.min(100, (storage.used_bytes / storage.limit_bytes) * 100)
      : storage.used_bytes > 0
        ? 100
        : 0;
  const showBar = storage.mode !== 'USER_WORKDRIVE' || storage.used_bytes > 0;

  return (
    <div data-testid="storage-settings">
      <section className="oma-bs-card" aria-labelledby="storage-title">
        <h2 id="storage-title" className="oma-bs-card__title">
          {t('storage.title')}
        </h2>
        <p className="oma-bs-card__desc">{t('storage.desc')}</p>
        <p className="oma-bs-hint">{t('storage.explainer')}</p>
        {notice ? (
          <p className={`oma-bs-notice oma-bs-notice--${notice.kind}`} role="status">
            {notice.text}
          </p>
        ) : null}

        <div className="oma-st-modes" role="radiogroup" aria-labelledby="storage-title">
          {MODES.map((mode) => {
            const active = storage.mode === mode;
            const copy = MODE_COPY[mode];
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!enabled[mode] || busy === mode}
                className={`oma-st-mode${active ? ' oma-st-mode--active' : ''}`}
                data-testid={`storage-mode-${mode}`}
                onClick={() => void pick(mode)}
              >
                <span className="oma-st-mode__title">
                  {t(copy.title)}
                  {active ? (
                    <span className="oma-st-mode__badge">{t('storage.current')}</span>
                  ) : null}
                </span>
                <p className="oma-st-mode__desc">{t(copy.desc)}</p>
                {mode === 'SYNC_BACKUP' ? (
                  <p className="oma-st-mode__desc" data-testid="storage-sync-soon">
                    {t('storage.mode.sync.soon')}
                  </p>
                ) : null}
                {!enabled[mode] && reason[mode] ? (
                  <p className="oma-st-mode__desc">{reason[mode]}</p>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="oma-st-usage" data-testid="storage-usage-bar">
          <p className="oma-bs-label">{t('storage.usage.title')}</p>
          {storage.mode === 'USER_WORKDRIVE' ? (
            <p className="oma-bs-hint" data-testid="storage-usage-byos">
              {t('storage.usage.byos')}
            </p>
          ) : null}
          {showBar ? (
            <>
              <div className="oma-st-usage__track" aria-hidden="true">
                <div className="oma-st-usage__fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="oma-bs-hint">{usedLabel}</p>
              {storage.mode === 'USER_WORKDRIVE' && storage.used_bytes > 0 ? (
                <p className="oma-bs-hint">{t('storage.usage.byosNote')}</p>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <WorkDriveSettings t={t} locale={locale} canManage={canManage} onChanged={load} />
    </div>
  );
}
