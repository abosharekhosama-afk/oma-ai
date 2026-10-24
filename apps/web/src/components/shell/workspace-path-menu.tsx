'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useT } from '../../lib/use-locale';
import { ShellIcon } from './shell-icons';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
};

type BrandItem = {
  id: string;
  name: string;
};

/**
 * Planable path workspace menu (matches live Planable header dropdown):
 * - Header with mark + name
 * - Settings | Members chip row
 * - Active workspace row with check
 * - New workspace / Switch company
 */
export function WorkspacePathMenu({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await api<Me>('/api/v1/auth/me');
        if (cancelled) return;
        setMe(profile);
        const list = await api<{ data: BrandItem[] }>('/api/v1/brands?limit=50');
        if (!cancelled) setBrands(Array.isArray(list.data) ? list.data : []);
      } catch {
        if (!cancelled) {
          setMe(null);
          setBrands([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const company =
    me?.memberships.find((membership) => membership.tenant_id === me.active_tenant_id)
      ?.tenant_name ||
    me?.memberships[0]?.tenant_name ||
    t('shell.workspace') ||
    'Workspace';
  const activeBrand = brands[0];
  const name = activeBrand?.name || company;

  return (
    <div className="oma-path-ws" ref={rootRef}>
      <button
        type="button"
        className="oma-breadcrumb-workspace"
        data-testid="shell-workspace-path"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="oma-breadcrumb-workspace-mark" aria-hidden />
        <span className="oma-breadcrumb-workspace-label">{name}</span>
        <span className="oma-breadcrumb-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="oma-path-ws-menu" role="menu" data-testid="shell-workspace-path-menu">
          <div className="oma-path-ws-menu__head">
            <span className="oma-breadcrumb-workspace-mark" aria-hidden />
            <strong className="oma-path-ws-menu__title">{name}</strong>
          </div>

          <div className="oma-path-ws-menu__chips">
            <button
              type="button"
              role="menuitem"
              className="oma-path-ws-menu__chip"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              <ShellIcon name="settings" size={14} />
              <span>{t('shell.settings') || 'Settings'}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="oma-path-ws-menu__chip"
              onClick={() => {
                setOpen(false);
                window.location.assign('/app/team');
              }}
            >
              <ShellIcon name="team" size={14} />
              <span>{t('nav.team') || 'Members'}</span>
            </button>
          </div>

          <div className="oma-path-ws-menu__list">
            {(brands.length ? brands.slice(0, 6) : [{ id: 'active', name }]).map((brand, idx) => (
              <button
                key={brand.id}
                type="button"
                role="menuitem"
                className="oma-ws-menu-item oma-path-ws-menu__ws"
                data-active={idx === 0 ? 'true' : 'false'}
                onClick={() => {
                  setOpen(false);
                  if (brand.id !== 'active') window.location.assign(`/app/brands/${brand.id}`);
                }}
              >
                <span className="oma-path-ws-menu__ws-icon" aria-hidden>
                  ⊞
                </span>
                <span className="oma-path-ws-menu__ws-name">{brand.name}</span>
                {idx === 0 ? (
                  <span className="oma-path-ws-menu__check" aria-hidden>
                    ✓
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <button
            type="button"
            role="menuitem"
            className="oma-ws-menu-item"
            onClick={() => {
              setOpen(false);
              window.location.assign('/app/brands/new');
            }}
          >
            <ShellIcon name="plus" size={14} />
            <span>{t('shell.newWorkspace') || 'New workspace'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="oma-ws-menu-item"
            onClick={() => {
              setOpen(false);
              window.location.assign('/app/select-company');
            }}
          >
            <ShellIcon name="company" size={14} />
            <span>{t('shell.switchCompany') || 'Switch company'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
