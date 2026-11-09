'use client';

import { Button } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { getApiError } from '../../lib/brand-api';
import {
  formatBytes,
  workDriveApi,
  type StorageMode,
  type WorkspaceBackup,
  type WorkspaceMigration,
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
  const [backup, setBackup] = useState<WorkspaceBackup | null>(null);
  const [migrate, setMigrate] = useState<WorkspaceMigration | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<StorageMode | null>(null);
  const [backupBusy, setBackupBusy] = useState<'backfill' | 'retry' | null>(null);
  const [migrateBusy, setMigrateBusy] = useState<'start' | 'cancel' | null>(null);
  const [deleteSource, setDeleteSource] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    workDriveApi
      .storage()
      .then((r) => setStorage(r.data))
      .catch((e) => setLoadError(getApiError(e).message));
    workDriveApi
      .backup()
      .then((r) => setBackup(r.data))
      .catch(() => setBackup(null));
    workDriveApi
      .migrate()
      .then((r) => setMigrate(r.data))
      .catch(() => setMigrate(null));
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
      workDriveApi
        .backup()
        .then((b) => setBackup(b.data))
        .catch(() => undefined);
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

      {backup &&
      (storage.mode === 'SYNC_BACKUP' || Object.values(backup.counts).some((n) => n > 0)) ? (
        <section className="oma-bs-card oma-st-backup" data-testid="storage-backup-status">
          <p className="oma-bs-label">{t('storage.backup.title')}</p>
          <p className="oma-bs-hint">{t('storage.backup.desc')}</p>
          {backup.paused ? (
            <p
              className="oma-bs-notice oma-bs-notice--error"
              role="alert"
              data-testid="storage-backup-paused"
            >
              {backup.paused_reason === 'quota_exceeded'
                ? t('storage.backup.pausedQuota')
                : t('storage.backup.pausedKey')}
            </p>
          ) : null}
          <dl className="oma-wd-facts" data-testid="storage-backup-counts">
            <div>
              <dt>{t('storage.backup.pending')}</dt>
              <dd>{backup.counts.pending + backup.counts.running}</dd>
            </div>
            <div>
              <dt>{t('storage.backup.done')}</dt>
              <dd>{backup.counts.done}</dd>
            </div>
            <div>
              <dt>{t('storage.backup.failed')}</dt>
              <dd>{backup.counts.failed}</dd>
            </div>
            <div>
              <dt>{t('storage.backup.skipped')}</dt>
              <dd>{backup.counts.skipped}</dd>
            </div>
          </dl>
          {backup.last_success_at ? (
            <p className="oma-bs-hint">
              {t('storage.backup.lastSuccess').replace(
                '{when}',
                new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(backup.last_success_at)),
              )}
            </p>
          ) : null}
          {backup.last_error?.message ? (
            <p className="oma-bs-hint" data-testid="storage-backup-last-error">
              {t('storage.backup.lastError').replace('{error}', backup.last_error.message)}
            </p>
          ) : null}
          <div className="oma-bs-actions">
            <Button
              loading={backupBusy === 'backfill'}
              data-testid="storage-backup-backfill"
              onClick={async () => {
                setBackupBusy('backfill');
                setNotice(null);
                try {
                  const r = await workDriveApi.backfillBackup();
                  setNotice({
                    kind: 'success',
                    text: t('storage.backup.backfillOk').replace('{n}', String(r.data.enqueued)),
                  });
                  const b = await workDriveApi.backup();
                  setBackup(b.data);
                } catch (e) {
                  setNotice({ kind: 'error', text: getApiError(e).message });
                } finally {
                  setBackupBusy(null);
                }
              }}
            >
              {t('storage.backup.backfill')}
            </Button>
            <Button
              loading={backupBusy === 'retry'}
              disabled={!backup.paused && backup.counts.failed === 0}
              data-testid="storage-backup-retry"
              onClick={async () => {
                setBackupBusy('retry');
                setNotice(null);
                try {
                  const r = await workDriveApi.retryFailedBackup();
                  setNotice({
                    kind: 'success',
                    text: t('storage.backup.retryOk').replace('{n}', String(r.data.retried)),
                  });
                  const b = await workDriveApi.backup();
                  setBackup(b.data);
                } catch (e) {
                  setNotice({ kind: 'error', text: getApiError(e).message });
                } finally {
                  setBackupBusy(null);
                }
              }}
            >
              {t('storage.backup.retry')}
            </Button>
          </div>
        </section>
      ) : null}

      {migrate ? (
        <section className="oma-bs-card oma-st-migrate" data-testid="storage-migrate">
          <p className="oma-bs-label">{t('storage.migrate.title')}</p>
          <p className="oma-bs-hint">{t('storage.migrate.desc')}</p>
          {migrate.candidate_count > 0 ? (
            <p className="oma-bs-hint" data-testid="storage-migrate-candidates">
              {t('storage.migrate.candidates')
                .replace('{count}', String(migrate.candidate_count))
                .replace('{size}', formatBytes(migrate.candidate_bytes, locale))}
            </p>
          ) : (
            <p className="oma-bs-hint" data-testid="storage-migrate-none">
              {t('storage.migrate.none')}
            </p>
          )}
          {migrate.quota_blocked ? (
            <p
              className="oma-bs-notice oma-bs-notice--error"
              role="alert"
              data-testid="storage-migrate-quota"
            >
              {t('storage.migrate.quotaWarning')
                .replace('{used}', formatBytes(migrate.used_bytes, locale))
                .replace(
                  '{limit}',
                  migrate.limit_bytes == null
                    ? t('storage.usage.unlimited')
                    : formatBytes(migrate.limit_bytes, locale),
                )
                .replace('{needed}', formatBytes(migrate.candidate_bytes, locale))}
            </p>
          ) : null}
          {migrate.migration ? (
            <p className="oma-bs-hint" data-testid="storage-migrate-progress">
              {t(`storage.migrate.status.${migrate.migration.status}`)}
              {' · '}
              {t('storage.migrate.progress')
                .replace('{completed}', String(migrate.migration.completed))
                .replace('{total}', String(migrate.migration.total))
                .replace('{failed}', String(migrate.migration.failed))
                .replace('{skipped}', String(migrate.migration.skipped))}
            </p>
          ) : null}
          <label className="oma-bs-hint" data-testid="storage-migrate-delete-source">
            <input
              type="checkbox"
              checked={deleteSource}
              onChange={(e) => setDeleteSource(e.target.checked)}
            />{' '}
            {t('storage.migrate.deleteSource')}
          </label>
          <div className="oma-st-backup__actions">
            <Button
              loading={migrateBusy === 'start'}
              disabled={!migrate.can_start}
              data-testid="storage-migrate-start"
              onClick={async () => {
                setMigrateBusy('start');
                try {
                  const r = await workDriveApi.startMigrate(deleteSource);
                  setMigrate(r.data);
                  setNotice({ kind: 'success', text: t('storage.migrate.started') });
                } catch (e) {
                  setNotice({ kind: 'error', text: getApiError(e).message });
                } finally {
                  setMigrateBusy(null);
                }
              }}
            >
              {t('storage.migrate.start')}
            </Button>
            <Button
              loading={migrateBusy === 'cancel'}
              disabled={
                !migrate.migration || !['PENDING', 'RUNNING'].includes(migrate.migration.status)
              }
              data-testid="storage-migrate-cancel"
              onClick={async () => {
                setMigrateBusy('cancel');
                try {
                  const r = await workDriveApi.cancelMigrate();
                  setMigrate(r.data);
                  setNotice({ kind: 'success', text: t('storage.migrate.cancelled') });
                } catch (e) {
                  setNotice({ kind: 'error', text: getApiError(e).message });
                } finally {
                  setMigrateBusy(null);
                }
              }}
            >
              {t('storage.migrate.cancel')}
            </Button>
          </div>
        </section>
      ) : null}

      <WorkDriveSettings t={t} locale={locale} canManage={canManage} onChanged={load} />
    </div>
  );
}
