'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
};

export function TenantSwitcher() {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Me>('/api/v1/auth/me')
      .then(setMe)
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <p role="alert" className="oma-shell-note">
        {error}
      </p>
    );
  if (!me) return <p className="oma-shell-note oma-muted">{t('common.loading')}</p>;
  if (me.memberships.length === 0)
    return <p className="oma-shell-note">{t('shell.emptyMembership')}</p>;

  const options = [...me.memberships].sort((a, b) => a.tenant_name.localeCompare(b.tenant_name));

  return (
    <label className="oma-field-inline">
      <span className="oma-field-inline-label">{t('shell.tenant')}</span>
      <select
        className="oma-select"
        aria-label={t('shell.tenant')}
        value={me.active_tenant_id ?? ''}
        disabled={busy}
        onChange={async (e) => {
          const tenantId = e.target.value;
          if (!tenantId) return;
          setBusy(true);
          try {
            await api('/api/v1/tenants/active', {
              method: 'POST',
              body: JSON.stringify({ tenant_id: tenantId }),
            });
            // Active tenant scopes every request below the shell, so reload the
            // whole document rather than leaving mounted views on stale data.
            window.location.assign('/app');
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(false);
          }
        }}
      >
        <option value="" disabled>
          {t('shell.selectTenant')}
        </option>
        {options.map((m) => (
          <option key={m.tenant_id} value={m.tenant_id}>
            {m.tenant_name}
          </option>
        ))}
      </select>
    </label>
  );
}
