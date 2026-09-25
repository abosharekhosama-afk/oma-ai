'use client';
import { Input } from '@oma/ui/controls';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    api<Me>('/api/v1/auth/me')
      .then(setMe)
      .catch((e) => setError(e.message));
  }, []);

  const options = useMemo(() => {
    if (!me) return [];
    const sorted = [...me.memberships].sort((a, b) => a.tenant_name.localeCompare(b.tenant_name));
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (m) =>
        m.tenant_name.toLowerCase().includes(q) ||
        m.tenant_id.toLowerCase().includes(q) ||
        m.tenant_id.slice(-6).toLowerCase().includes(q),
    );
  }, [me, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  async function activate(tenantId: string) {
    if (!tenantId || busy) return;
    setBusy(true);
    try {
      await api('/api/v1/tenants/active', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      window.location.assign('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (error)
    return (
      <p role="alert" className="oma-shell-note">
        {error}
      </p>
    );
  if (!me) return <p className="oma-shell-note oma-muted">{t('common.loading')}</p>;
  if (me.memberships.length === 0)
    return (
      <p className="oma-shell-note">
        <a href="/app/onboarding">{t('shell.emptyMembershipCta')}</a>
      </p>
    );

  const active = me.memberships.find((m) => m.tenant_id === me.active_tenant_id);
  const labelFor = (m: Me['memberships'][number]) => {
    const dupCount = me.memberships.filter((x) => x.tenant_name === m.tenant_name).length;
    if (dupCount > 1) {
      return `${m.tenant_name} · …${m.tenant_id.slice(-6)}`;
    }
    return m.tenant_name;
  };

  return (
    <div className="oma-field-inline oma-tenant-switcher">
      <span className="oma-field-inline-label" id="tenant-switcher-label">
        {t('shell.tenant')}
      </span>
      <div className="oma-combobox">
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls="tenant-switcher-list"
          aria-labelledby="tenant-switcher-label"
          aria-autocomplete="list"
          aria-activedescendant={
            options[activeIndex] ? `tenant-opt-${options[activeIndex].tenant_id}` : undefined
          }
          placeholder={active ? labelFor(active) : t('shell.selectTenant')}
          value={query}
          disabled={busy}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && options[activeIndex]) {
              e.preventDefault();
              void activate(options[activeIndex].tenant_id);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {open ? (
          <ul id="tenant-switcher-list" role="listbox" className="oma-combobox-list" ref={listRef}>
            {options.length === 0 ? (
              <li className="oma-combobox-empty" role="presentation">
                {t('shell.tenantSearchEmpty')}
              </li>
            ) : (
              options.map((m, idx) => (
                <li
                  key={m.tenant_id}
                  id={`tenant-opt-${m.tenant_id}`}
                  role="option"
                  aria-selected={m.tenant_id === me.active_tenant_id || idx === activeIndex}
                  className={
                    idx === activeIndex ? 'oma-combobox-option is-active' : 'oma-combobox-option'
                  }
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void activate(m.tenant_id);
                  }}
                >
                  {labelFor(m)}
                  {m.tenant_id === me.active_tenant_id ? (
                    <span className="oma-muted"> · {t('shell.activeCompany')}</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
