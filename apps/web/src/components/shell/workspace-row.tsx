'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/use-locale';
import { api } from '../../lib/api';
import { ShellIcon } from './shell-icons';
import { selectBrand, setActiveBrandId, useActiveBrandId } from '../../lib/active-brand';

type Me = {
  active_tenant_id: string | null;
  memberships: Array<{ id: string; tenant_id: string; tenant_name: string }>;
};
type BrandItem = { id: string; name: string };
type WorkspaceRowProps = { collapsed?: boolean; onOpenSettings: () => void };

/** Sidebar selectors for the active tenant (Workspace) and activeBrandId (Brand). */
export function WorkspaceRow({ collapsed = false, onOpenSettings }: WorkspaceRowProps) {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [busyTenant, setBusyTenant] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeBrandId = useActiveBrandId();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profile = await api<Me>('/api/v1/auth/me');
        if (cancelled) return;
        setMe(profile);
        if (profile.active_tenant_id) {
          const list = await api<{ data?: BrandItem[] }>('/api/v1/brands?limit=100');
          if (!cancelled) setBrands(Array.isArray(list.data) ? list.data : []);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setBrands([]);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const workspace = me?.memberships.find((item) => item.tenant_id === me.active_tenant_id);
  const workspaceName = workspace?.tenant_name || t('shell.workspace') || 'Workspace';
  const activeBrand = brands.find((brand) => brand.id === activeBrandId);
  const brandName = activeBrand?.name || t('shell.brandAll') || 'All brands';

  async function activateWorkspace(tenantId: string) {
    if (!tenantId || tenantId === me?.active_tenant_id || busyTenant) return;
    setBusyTenant(true);
    try {
      await api('/api/v1/tenants/active', {
        method: 'POST',
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      setActiveBrandId(null);
      window.location.assign('/app');
    } catch {
      setBusyTenant(false);
    }
  }

  if (collapsed) {
    return (
      <div className="oma-ws-row oma-ws-row--collapsed" title={`${workspaceName} · ${brandName}`}>
        <button
          type="button"
          className="oma-ws-collapsed-btn"
          aria-label={`${t('shell.workspace')}: ${workspaceName}; ${t('shell.brand')}: ${brandName}`}
          onClick={() => {
            window.location.assign('/app/select-company');
          }}
        >
          <span className="oma-ws-avatar">{(workspaceName[0] || 'W').toUpperCase()}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="oma-ws-row" ref={rootRef} data-testid="workspace-row">
      <button
        type="button"
        className="oma-ws-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="oma-ws-label">{t('shell.workspace') || 'Workspace'}</span>
        <svg
          className={`oma-ws-chevron${expanded ? ' is-open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </button>
      {expanded ? (
        <div className="oma-ws-body">
          <div className="oma-ws-name-row">
            <span className="oma-ws-avatar oma-ws-avatar--sm" aria-hidden>
              {(workspaceName[0] || 'W').toUpperCase()}
            </span>
            <button
              type="button"
              className="oma-ws-name"
              title={workspaceName}
              onClick={() => window.location.assign('/app/select-company')}
            >
              {workspaceName}
            </button>
            <div className="oma-ws-actions">
              <button
                type="button"
                className="oma-ws-more"
                aria-label={t('shell.workspaceActions') || 'Workspace actions'}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                data-testid="workspace-row-menu"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((value) => !value);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <circle cx="6" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="18" cy="12" r="1.6" />
                </svg>
              </button>
              {menuOpen ? (
                <div className="oma-ws-menu" role="menu" data-testid="workspace-row-workspace-menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenSettings();
                    }}
                  >
                    <ShellIcon name="settings" size={14} />
                    <span>{t('shell.workspaceSettings') || 'Workspace settings'}</span>
                  </button>
                  {(me?.memberships ?? []).map((membership) => (
                    <button
                      key={membership.tenant_id}
                      type="button"
                      role="menuitem"
                      className="oma-ws-menu-item"
                      data-active={membership.tenant_id === me?.active_tenant_id ? 'true' : 'false'}
                      onClick={() => {
                        setMenuOpen(false);
                        void activateWorkspace(membership.tenant_id);
                      }}
                    >
                      <ShellIcon name="company" size={14} />
                      <span>{membership.tenant_name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    className="oma-ws-menu-item"
                    data-testid="workspace-row-new"
                    onClick={() => {
                      setMenuOpen(false);
                      window.location.assign('/app/workspaces/new');
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
                      setMenuOpen(false);
                      window.location.assign('/app/team');
                    }}
                  >
                    <ShellIcon name="company" size={14} />
                    <span>{t('nav.team') || 'Members'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="oma-ws-brand-block" data-testid="workspace-row-brand-selector">
            <span className="oma-ws-label">{t('shell.brand') || 'Brand'}</span>
            <select
              className="oma-ws-brand-select"
              aria-label={t('shell.brandSelector') || 'Brand selector'}
              value={activeBrandId || ''}
              onChange={(event) => selectBrand(event.target.value || null)}
            >
              <option value="">{t('shell.brandAll') || 'All brands'}</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="oma-ws-brand-add"
              aria-label={t('shell.newBrand') || 'New brand'}
              onClick={() => window.location.assign('/app/brands/new')}
            >
              <ShellIcon name="plus" size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
