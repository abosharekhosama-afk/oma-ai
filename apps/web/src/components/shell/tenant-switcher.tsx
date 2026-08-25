'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ tenant_id: string; tenant_name: string }>;
};

export function TenantSwitcher() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Me>('/api/v1/auth/me')
      .then(setMe)
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!me) return <p className="oma-muted">Loading…</p>;
  if (me.memberships.length === 0) return <p>You have no active company membership.</p>;
  return (
    <label>
      Company{' '}
      <select
        aria-label="Company"
        value={me.active_tenant_id ?? ''}
        onChange={async (e) => {
          await api('/api/v1/tenants/active', {
            method: 'POST',
            body: JSON.stringify({ tenant_id: e.target.value }),
          });
          const next = await api<Me>('/api/v1/auth/me');
          setMe(next);
        }}
      >
        <option value="" disabled>
          Select
        </option>
        {me.memberships.map((m) => (
          <option key={m.tenant_id} value={m.tenant_id}>
            {m.tenant_name}
          </option>
        ))}
      </select>
    </label>
  );
}
