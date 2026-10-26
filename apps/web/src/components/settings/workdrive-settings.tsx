'use client';

import { Button, Input, Modal } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { getApiError } from '../../lib/brand-api';
import { workDriveApi, type WorkDriveStatus } from '../../lib/workdrive-api';

type Tr = (key: string) => string;

function fmtDate(iso: string | null, locale: string) {
  if (!iso) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** Workspace → Settings → WorkDrive: connect the workspace's WorkDrive with an app access key. */
export function WorkDriveSettings({
  t,
  locale,
  canManage,
}: {
  t: Tr;
  locale: string;
  canManage: boolean;
}) {
  const [status, setStatus] = useState<WorkDriveStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'connect' | 'test' | 'disconnect' | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const load = useCallback(() => {
    workDriveApi
      .status()
      .then((r) => {
        setStatus(r.data);
        setUrl((u) => u || r.data.connection?.base_url || r.data.default_url || '');
      })
      .catch((e) => setLoadError(getApiError(e).message));
  }, []);
  useEffect(load, [load]);

  if (!canManage)
    return (
      <section className="oma-bs-card" data-testid="workdrive-settings">
        <h2 className="oma-bs-card__title">{t('workdrive.title')}</h2>
        <p className="oma-bs-card__desc">{t('workdrive.adminOnly')}</p>
      </section>
    );
  if (loadError)
    return (
      <section className="oma-bs-card" data-testid="workdrive-settings">
        <h2 className="oma-bs-card__title">{t('workdrive.title')}</h2>
        <p className="oma-bs-notice oma-bs-notice--error" role="alert">
          {loadError}
        </p>
      </section>
    );
  if (!status) return <div className="oma-bs-card oma-wd-skeleton" aria-busy="true" />;

  const conn = status.connection;
  const keyValid = /^wdk_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/.test(key.trim());
  const urlValid = /^https?:\/\/[^\s/]+/.test(url.trim());

  const connect = async () => {
    setBusy('connect');
    setNotice(null);
    try {
      const r = await workDriveApi.connect(url.trim(), key.trim());
      setStatus(r.data);
      setKey('');
      setReplacing(false);
      setNotice({
        kind: 'success',
        text: t('workdrive.connected').replace('{org}', r.data.connection?.org_name ?? ''),
      });
    } catch (e) {
      setNotice({ kind: 'error', text: getApiError(e).message });
    } finally {
      setBusy(null);
    }
  };

  const form = (
    <div className="oma-wd-form" data-testid="workdrive-form">
      <label className="oma-bs-label" htmlFor="wd-url">
        {t('workdrive.url')}
      </label>
      <Input
        id="wd-url"
        className="oma-ltr"
        dir="ltr"
        value={url}
        placeholder="https://"
        autoComplete="off"
        data-testid="workdrive-url"
        onChange={(e) => setUrl(e.target.value)}
      />
      <p className="oma-bs-hint">{t('workdrive.urlHint')}</p>
      <label className="oma-bs-label" htmlFor="wd-key">
        {t('workdrive.key')}
      </label>
      <Input.Password
        id="wd-key"
        className="oma-ltr"
        dir="ltr"
        value={key}
        autoComplete="new-password"
        placeholder="wdk_…"
        data-testid="workdrive-key"
        onChange={(e) => setKey(e.target.value)}
      />
      <p className="oma-bs-hint">{t('workdrive.keyHint')}</p>
      {key && !keyValid ? (
        <p className="oma-bs-error" role="alert">
          {t('workdrive.keyInvalid')}
        </p>
      ) : null}
      <div className="oma-bs-actions">
        <Button
          type="primary"
          disabled={!keyValid || !urlValid}
          loading={busy === 'connect'}
          data-testid="workdrive-connect"
          onClick={connect}
        >
          {conn ? t('workdrive.saveKey') : t('workdrive.connect')}
        </Button>
        {conn ? (
          <Button onClick={() => setReplacing(false)}>{t('common.cancel')}</Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className="oma-bs-card" data-testid="workdrive-settings" aria-labelledby="wd-title">
      <h2 id="wd-title" className="oma-bs-card__title">
        {t('workdrive.title')}
      </h2>
      <p className="oma-bs-card__desc">{t('workdrive.desc')}</p>
      {notice ? (
        <p className={`oma-bs-notice oma-bs-notice--${notice.kind}`} role="status">
          {notice.text}
        </p>
      ) : null}

      {!status.available ? (
        <p className="oma-wd-empty" data-testid="workdrive-unavailable">
          {t('workdrive.notEnabled')}
        </p>
      ) : conn ? (
        <>
          <dl className="oma-wd-facts" data-testid="workdrive-connection">
            <div>
              <dt>{t('workdrive.organization')}</dt>
              <dd>
                <strong data-testid="workdrive-org">{conn.org_name}</strong>{' '}
                <span
                  className={`oma-bs-status oma-bs-status--${conn.status === 'CONNECTED' ? 'connected' : 'error'}`}
                >
                  {conn.status === 'CONNECTED' ? t('workdrive.statusOk') : t('workdrive.statusError')}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t('workdrive.address')}</dt>
              <dd className="oma-ltr" dir="ltr">
                {conn.base_url}
              </dd>
            </div>
            <div>
              <dt>{t('workdrive.folder')}</dt>
              <dd>{conn.root_folder?.name ?? t('workdrive.wholeDrive')}</dd>
            </div>
            <div>
              <dt>{t('workdrive.keyLabel')}</dt>
              <dd className="oma-ltr" dir="ltr">
                {conn.key_prefix}…
              </dd>
            </div>
            <div>
              <dt>{t('workdrive.lastChecked')}</dt>
              <dd>{fmtDate(conn.last_checked_at, locale)}</dd>
            </div>
          </dl>
          {conn.status !== 'CONNECTED' && conn.last_error ? (
            <p className="oma-bs-notice oma-bs-notice--error" role="alert">
              {t(conn.last_error)}
            </p>
          ) : null}
          <p className="oma-bs-hint">
            {t('workdrive.layout').replace(
              '{path}',
              conn.root_folder?.name?.toLowerCase() === 'oma'
                ? `${conn.root_folder.name} / …`
                : 'OMA / …',
            )}
          </p>
          {replacing ? (
            form
          ) : (
            <div className="oma-bs-actions">
              <Button
                loading={busy === 'test'}
                data-testid="workdrive-test"
                onClick={async () => {
                  setBusy('test');
                  setNotice(null);
                  try {
                    const r = await workDriveApi.test();
                    setStatus(r.data);
                    setNotice(
                      r.data.connection?.status === 'CONNECTED'
                        ? { kind: 'success', text: t('workdrive.testOk') }
                        : { kind: 'error', text: t('workdrive.testFailed') },
                    );
                  } catch (e) {
                    setNotice({ kind: 'error', text: getApiError(e).message });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {t('workdrive.test')}
              </Button>
              <Button onClick={() => setReplacing(true)}>{t('workdrive.replaceKey')}</Button>
              <Button danger data-testid="workdrive-disconnect" onClick={() => setConfirmOff(true)}>
                {t('workdrive.disconnect')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="oma-wd-empty" data-testid="workdrive-not-connected">
            {t('workdrive.notConnected')}
          </p>
          {form}
        </>
      )}

      <Modal
        open={confirmOff}
        title={t('workdrive.disconnectTitle')}
        okText={t('workdrive.disconnect')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true, loading: busy === 'disconnect' }}
        onCancel={() => setConfirmOff(false)}
        onOk={async () => {
          setBusy('disconnect');
          try {
            const r = await workDriveApi.disconnect();
            setStatus(r.data);
            setConfirmOff(false);
            setNotice({ kind: 'success', text: t('workdrive.disconnected') });
          } catch (e) {
            setNotice({ kind: 'error', text: getApiError(e).message });
          } finally {
            setBusy(null);
          }
        }}
      >
        <p>{t('workdrive.disconnectBody')}</p>
      </Modal>
    </section>
  );
}
